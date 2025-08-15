# Flows Database Integration Setup

This guide explains how to set up the comprehensive flows database that captures all data from your slide builder workflow.

## 🎯 Overview

The flows system consolidates all the fragmented flow tables (`flow_content_plans`, `flow_documents`, etc.) into one comprehensive `flows` table that stores complete builder session data.

## 📋 Setup Steps

### 1. Run the Database Migration

First, run the SQL migration to create the new flows table:

```bash
# Option 1: Apply the migration file directly
cd supabase
npx supabase db reset  # If you want to reset completely
# OR apply the specific migration:
```

Or manually run the SQL in your Supabase dashboard:
```sql
-- Copy and paste the contents of:
-- supabase/migrations/20250114_consolidate_flows_table.sql
```

### 2. Update Your Build Page

Replace your current build page with the flows-integrated version:

```bash
# Backup your current build page
mv app/build/page.tsx app/build/page-backup.tsx

# Use the new flows-integrated version
mv app/build/page-with-flows.tsx app/build/page.tsx
```

### 3. Install Required Dependencies

Make sure you have all the required packages:

```bash
npm install @supabase/auth-helpers-nextjs
```

### 4. Update Your Presentations Page (Optional)

Add the flows list component to show saved flows:

```tsx
// In your presentations page or dashboard
import { FlowsList } from '@/components/flows-list';

// In your component:
<FlowsList />
```

## 🔧 Integration Guide

### Option A: Full Migration (Recommended)

Use the new flows-integrated build page for complete functionality:
- Automatic flow creation and saving
- Progress tracking
- Resume from any step
- Complete data persistence

### Option B: Gradual Integration

If you prefer to integrate gradually, use the utility functions in existing components:

```tsx
// Example: Adding flow saving to content-step.tsx
import { saveFlowAfterAPI, getFlowId } from '@/lib/flow-integration-utils';

const generateContentPlan = async () => {
  // ... existing logic ...
  
  // Add this after successful API call:
  const flowId = getFlowId();
  if (success && flowId) {
    await saveFlowAfterAPI(flowId, 2, 'content_planning', {
      contentPlan: data.contentPlan
    });
  }
};
```

## 📊 What Gets Captured

The flows table captures ALL data from each step:

### Step 1: Upload
- File metadata (`documents`)
- Parsed content (`parsed_documents`) 
- AI model selection (`selected_model`)
- User description (`description`)

### Step 2: Content Planning
- AI-generated content plan (`content_plan`)
- User feedback (`user_feedback`)
- Generation timestamp

### Step 3: Research  
- Research preference (`wants_research`)
- Research configuration (`research_options`)
- Research results (`research_data`)
- Completion timestamp

### Step 4: Theme Selection
- Selected template (`selected_theme`)
- Color palette (`selected_palette`)
- Customizations (`theme_customizations`)

### Step 5: Preview
- Generated slide HTML (`slide_html`)
- Generated slide JSON (`slide_json`)
- Generation metadata and timestamps

### Step 6: Download/Export
- Download history (`download_history`)
- Share links (`share_links`)
- Export timestamps

### Analytics & Tracking
- Step completion timestamps (`step_timestamps`)
- API call counts (`api_calls_made`)
- Error logs (`error_logs`)
- Performance metrics (`total_generation_time`)

## 🔄 Flow States

Flows progress through these states:
- `draft` - Initial creation, step 1
- `in_progress` - Working through steps 2-5  
- `completed` - Finished step 6
- `archived` - Soft deleted

## 📱 Usage Examples

### Create a New Flow
```tsx
const { createFlow } = useFlow();

const newFlowId = await createFlow({
  description: "Q3 Business Review",
  documents: [],
  selectedTheme: "",
  wantsResearch: false
});
```

### Load and Continue Existing Flow
```tsx
const { loadFlow, slideData, flow } = useFlow();

useEffect(() => {
  if (flowId) {
    loadFlow(flowId);
  }
}, [flowId]);

// Flow data is automatically available in slideData
```

### Save Progress at Each Step
```tsx
const { updateSlideData, saveCurrentStep } = useFlow();

// Updates are auto-saved, or manually save:
const handleStepComplete = async () => {
  await saveCurrentStep(currentStep);
};
```

## 🎛️ API Endpoints

The integration adds these API routes:

- `GET /api/flows` - List user's flows
- `POST /api/flows` - Create new flow
- `GET /api/flows/[id]` - Get specific flow
- `PATCH /api/flows/[id]` - Update flow
- `DELETE /api/flows/[id]` - Archive flow

## 🔍 Database Schema

Key fields in the `flows` table:

```sql
-- Core identification
id UUID PRIMARY KEY
user_id UUID REFERENCES auth.users(id)
created_at, updated_at TIMESTAMP

-- Progress tracking  
current_step INTEGER (1-6)
status TEXT ('draft'|'in_progress'|'completed'|'archived')

-- Step data (see above for complete list)
description TEXT NOT NULL
documents JSONB
content_plan TEXT
research_data TEXT
selected_theme TEXT
slide_json JSONB
-- ... and many more fields
```

## 🚀 Benefits

1. **Complete Data Persistence** - Never lose progress
2. **Resume Anywhere** - Pick up where you left off
3. **Analytics Ready** - Track usage patterns and performance
4. **Audit Trail** - See exactly what happened at each step
5. **Error Recovery** - Debug issues with complete logs
6. **User Experience** - Seamless flow between sessions

## 🔧 Troubleshooting

### Migration Issues
- Make sure to backup existing data before running migration
- Check Supabase logs for constraint violations
- Verify RLS policies are working correctly

### Integration Issues  
- Ensure authentication is working (`user.id` available)
- Check browser console for API errors
- Verify flow ID is being passed between pages

### Performance Issues
- The table includes indexes for common queries
- Consider archiving old flows periodically
- Monitor JSONB field sizes for large documents

## 📈 Next Steps

1. Run the migration ✅
2. Test with a sample flow ✅  
3. Add flows list to presentations page
4. Add flow management features (rename, duplicate, etc.)
5. Add analytics dashboard for flow insights
6. Consider flow templates for common use cases

The flows system provides a solid foundation for capturing and managing all slide builder data. Let me know if you need help with any part of the integration!