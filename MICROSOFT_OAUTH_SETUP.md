# Microsoft OAuth Integration Setup

## 🔧 Current Status
✅ Code is already implemented in `components/login-form.tsx`
✅ Uses Supabase's `azure` provider
✅ Callback handling is configured
❌ Needs Azure app registration and Supabase configuration

## 📋 Setup Steps

### 1. Microsoft Azure App Registration

1. **Go to Azure Portal**: https://portal.azure.com
2. **Navigate to**: Azure Active Directory > App registrations > New registration
3. **Configure the app**:
   - **Name**: `SlideFlip App` (or your preferred name)
   - **Supported account types**: `Accounts in any organizational directory and personal Microsoft accounts`
   - **Redirect URI**: `https://[your-supabase-project].supabase.co/auth/v1/callback`

4. **Note down these values** (you'll need them for Supabase):
   - **Application (client) ID**
   - **Directory (tenant) ID**

5. **Create a client secret**:
   - Go to `Certificates & secrets` > `New client secret`
   - **Important**: Copy the secret value immediately (you won't see it again!)

6. **Configure API permissions**:
   - Go to `API permissions` > `Add a permission`
   - **Microsoft Graph** > **Delegated permissions**
   - Add: `openid`, `profile`, `email`, `User.Read`
   - Click `Grant admin consent` (if you're an admin)

### 2. Supabase Configuration

1. **Go to your Supabase Dashboard**: https://supabase.com/dashboard
2. **Navigate to**: Authentication > Providers > Azure
3. **Enable Azure provider** and configure:
   - **Azure client ID**: [Application (client) ID from step 4]
   - **Azure secret**: [Client secret from step 5]
   - **Azure tenant ID**: [Directory (tenant) ID from step 4]

### 3. Environment Variables

Your `.env.local` should already have:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Testing

1. **Start your development server**: `npm run dev`
2. **Go to**: http://localhost:3000/auth/login
3. **Click**: "Continue with Microsoft"
4. **Should redirect to**: Microsoft login page
5. **After login**: Should redirect back to your app

## 🛠️ Current Implementation Details

The Microsoft OAuth is implemented in `components/login-form.tsx`:

```typescript
onClick={async () => {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    }
  });
}}
```

## 🔍 Troubleshooting

- **Invalid redirect URI**: Ensure the redirect URI in Azure matches your Supabase project URL exactly
- **Missing permissions**: Make sure all required permissions are granted in Azure
- **Client secret expired**: Client secrets expire - create a new one if needed
- **Wrong tenant**: Ensure you're using the correct tenant ID

## 📚 Reference Links

- [Supabase Azure OAuth docs](https://supabase.com/docs/guides/auth/social-login/auth-azure)
- [Microsoft Azure app registration](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
