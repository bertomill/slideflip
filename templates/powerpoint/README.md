# PowerPoint Templates

This folder contains PowerPoint-compatible templates that can be used to create professional presentations. These templates are designed to work alongside our HTML slide templates and provide multiple format options for users.

## Template Formats

### 1. JSON Templates (Recommended)
- **Files**: `*.json`
- **Usage**: Programmatic creation via PowerPoint APIs or automation tools
- **Benefits**: Precise positioning, consistent formatting, easy to modify
- **Best for**: Automated slide generation, bulk creation

### 2. VBA Macros
- **Files**: `*.vba`
- **Usage**: Run directly in PowerPoint to create template slides
- **Benefits**: Native PowerPoint integration, immediate results
- **Best for**: Manual template creation, one-off slides

### 3. XML Structure
- **Files**: `*.xml`
- **Usage**: Direct PowerPoint slide XML for advanced users
- **Benefits**: Complete control over slide structure
- **Best for**: Custom PowerPoint add-ins, advanced automation

### 4. Documentation
- **Files**: `*.md`
- **Usage**: Step-by-step instructions for manual creation
- **Benefits**: Human-readable, easy to follow
- **Best for**: Manual recreation, understanding template structure

## Available Templates

### Professional Gradient
- **Theme**: Professional business presentations
- **Colors**: Blue to purple gradient (#667eea → #764ba2)
- **Features**: Glass morphism effects, centered layout, statistics display
- **Use Cases**: Executive presentations, quarterly reports, business pitches

### Modern Clean
- **Theme**: Minimalist corporate design
- **Colors**: White background with blue accents (#3b82f6)
- **Features**: Clean typography, statistical cards, bullet points
- **Use Cases**: Product launches, team updates, client presentations

## How to Use

### Method 1: JSON Templates (Programmatic)
```javascript
// Example using Office.js API
const template = require('./professional-gradient.json');
// Use template data to create PowerPoint slides programmatically
```

### Method 2: VBA Macros
1. Open PowerPoint
2. Press `Alt + F11` to open VBA Editor
3. Insert → Module
4. Copy and paste the VBA code from `*.vba` files
5. Run the macro to create the template slide

### Method 3: Manual Creation
1. Follow the instructions in the corresponding `.md` files
2. Create slides manually using the specified formatting
3. Save as PowerPoint template (`.potx`) for reuse

## Integration with AI Generation

These templates serve as examples for our AI slide generation system:

1. **Structure Reference**: AI learns layout patterns from these templates
2. **Styling Guide**: Color schemes and typography are used as examples
3. **Content Organization**: Element positioning and hierarchy inform AI decisions
4. **Format Compatibility**: Ensures generated slides work well in PowerPoint

## Customization

### Colors
- Modify the `colors` arrays in JSON templates
- Update RGB values in VBA macros
- Change hex codes in documentation

### Fonts
- Update `font.family` properties in JSON
- Modify `.Font.Name` in VBA code
- Ensure fonts are available on target systems

### Layout
- Adjust `position` coordinates in JSON templates
- Modify shape positions in VBA code
- Update measurements in documentation

## File Structure
```
templates/powerpoint/
├── professional-gradient.json     # JSON template definition
├── professional-gradient.vba      # VBA macro for creation
├── professional-gradient.xml      # Raw PowerPoint XML
├── professional-gradient.pptx-structure.md  # Manual instructions
├── modern-clean.json             # Minimalist template
├── modern-clean.pptx-structure.md
└── README.md                     # This file
```

## Technical Notes

### Dimensions
- All templates use 16:9 aspect ratio (720 x 405 points)
- Coordinates are in PowerPoint points (1/72 inch)
- Consistent with standard presentation formats

### Compatibility
- PowerPoint 2016 or later recommended
- Office 365 fully supported
- Some features may require newer versions

### Performance
- JSON templates are fastest for bulk generation
- VBA macros work well for individual slides
- XML provides maximum control but requires expertise

## Contributing

To add new PowerPoint templates:

1. Create the template in PowerPoint manually
2. Export structure to JSON format
3. Create corresponding VBA macro
4. Document manual creation steps
5. Update this README with template information

## Support

For issues with PowerPoint templates:
- Check PowerPoint version compatibility
- Verify font availability on system
- Ensure macros are enabled for VBA templates
- Test with sample data before production use