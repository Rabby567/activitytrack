

## Fix Application Name Display & Chart Colors

### Problem
The Application Usage Time chart is showing file names like "Untitled-1.indd" instead of the application name "Adobe InDesign". This happens because:
1. The current pattern matching only looks for "Adobe InDesign" in the window title
2. Many times the window title is just the filename (e.g., `*Untitled-1.indd`)
3. All bars appear the same color (black) instead of using distinct colors

### Solution

#### 1. Improve App Name Detection

Add file extension-based detection to map file types to their applications:

| File Extension | Application |
|---------------|-------------|
| `.indd` | Adobe InDesign |
| `.ai` | Adobe Illustrator |
| `.psd` | Adobe Photoshop |
| `.aep`, `.aet` | Adobe After Effects |
| `.prproj` | Adobe Premiere Pro |
| `.xd` | Adobe XD |
| `.fig` | Figma |
| `.sketch` | Sketch |
| `.docx`, `.doc` | Microsoft Word |
| `.xlsx`, `.xls` | Microsoft Excel |
| `.pptx`, `.ppt` | PowerPoint |
| `.pdf` | PDF Viewer |

The function will:
1. First check for file extensions in the name and map to application
2. Then check for application name patterns (existing logic)
3. Finally clean up any remaining garbage text

#### 2. Use More Vibrant Chart Colors

Replace the chart colors with more distinct, vibrant colors that will definitely show up:

```text
Current: Uses CSS variables like 'hsl(var(--chart-1))'
Updated: Use explicit vibrant colors like '#3B82F6', '#10B981', '#F59E0B', etc.
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Analytics.tsx` | Update `normalizeAppName` function with file extension detection, update COLORS array with vibrant explicit colors |

### Updated normalizeAppName Logic

```text
function normalizeAppName(appName):
  1. Check if empty -> return "Unknown"
  
  2. Check for file extensions:
     - .indd -> "Adobe InDesign"
     - .ai -> "Adobe Illustrator" 
     - .psd -> "Adobe Photoshop"
     - etc.
  
  3. Check for browser patterns (existing):
     - Google Chrome, Firefox, Edge, Safari, etc.
  
  4. Check for application patterns (existing):
     - Adobe apps, VS Code, Discord, etc.
  
  5. Clean up remaining text:
     - Remove " - title" suffixes
     - Remove file paths
     - Return cleaned name
```

### Updated Color Palette

Use explicit hex colors for better visibility:

```text
Application Usage Chart:
- Blue: #3B82F6
- Green: #10B981  
- Yellow: #F59E0B
- Red: #EF4444
- Purple: #8B5CF6
- Pink: #EC4899
- Cyan: #06B6D4
- Orange: #F97316
```

### Result

After implementation:
- "Untitled-1.indd" will display as "Adobe InDesign"
- "*Untitled-1.psd" will display as "Adobe Photoshop"
- Each bar in the chart will have a distinct, visible color
- Time spent in each application will be properly aggregated

