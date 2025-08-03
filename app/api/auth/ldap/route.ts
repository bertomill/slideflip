import { NextRequest, NextResponse } from 'next/server';
import { createLDAPClient } from '@/lib/ldap';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Check if LDAP is configured
    if (!process.env.LDAP_URL) {
      return NextResponse.json(
        { error: 'LDAP authentication is not configured' },
        { status: 500 }
      );
    }

    // Authenticate with LDAP
    const ldapClient = createLDAPClient();
    const ldapUser = await ldapClient.authenticate(username, password);

    if (!ldapUser) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create or update user in Supabase
    const supabase = await createClient();
    
    // Check if user exists in Supabase
    const { data: existingUser, error: getUserError } = await supabase
      .from('users')
      .select('*')
      .eq('email', ldapUser.email)
      .single();

    let userId: string;

    if (existingUser) {
      // Update existing user
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          display_name: ldapUser.cn,
          ldap_dn: ldapUser.dn,
          ldap_uid: ldapUser.uid,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user:', updateError);
        return NextResponse.json(
          { error: 'Failed to update user' },
          { status: 500 }
        );
      }

      userId = existingUser.id;
    } else {
      // Create new user in Supabase auth
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: ldapUser.email,
        password: Math.random().toString(36).slice(-8), // Random password since LDAP handles auth
        email_confirm: true,
        user_metadata: {
          full_name: ldapUser.cn,
          ldap_dn: ldapUser.dn,
          ldap_uid: ldapUser.uid,
          auth_type: 'ldap',
        },
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        );
      }

      userId = authUser.user.id;
    }

    // Generate a session token for the user
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: ldapUser.email,
    });

    if (sessionError) {
      console.error('Error generating session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: ldapUser.email,
        name: ldapUser.cn,
        ldap_uid: ldapUser.uid,
      },
      session_url: sessionData.properties?.action_link,
    });

  } catch (error) {
    console.error('LDAP authentication error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}