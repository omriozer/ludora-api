# Placeholder File Specifications

This document specifies the requirements for the 3 placeholder files needed for the enhanced page replacement system.

## Overview

The system detects document format and uses the appropriate placeholder file to maintain visual consistency:

1. **Portrait A4 PDF** - For standard A4 portrait documents
2. **Landscape A4 PDF** - For A4 landscape documents
3. **Slide PDF** - For slide-sized documents (matching SVG slide dimensions)

## File Specifications

### 1. `preview-not-available-portrait.pdf`

**Dimensions**: 595 × 842 points (A4 Portrait)
**Usage**: Replace restricted pages in portrait A4 PDF documents

**Content Requirements**:
- **Hebrew Text**: "עמוד זה בקובץ מוגן ויהיה זמין לאחר הרכישה" (This page in the file is protected and will be available after purchase)
- **Ludora Logo**: Include actual logo from `/assets/images/logo.png`
- **Lock Icon**: Visual indicator of restricted content
- **Professional Design**: Clean, minimal layout with proper Hebrew typography
- **Brand Colors**: Use Ludora brand colors consistently

**Layout Structure**:
- Background: Light gray (#f8f9fa) with subtle dot pattern
- Main content area: Centered white container with rounded corners
- Lock icon: Top center of content area
- Hebrew text: Large, bold headline below lock icon
- Additional messaging: Smaller text for upgrade prompt
- Ludora logo: Bottom center of content area
- Website URL: Bottom of page

### 2. `preview-not-available-landscape.pdf`

**Dimensions**: 842 × 595 points (A4 Landscape)
**Usage**: Replace restricted pages in landscape A4 PDF documents

**Content Requirements**:
- **Same content as portrait version** but optimized for landscape layout
- **Hebrew Text**: "עמוד זה בקובץ מוגן ויהיה זמין לאחר הרכישה"
- **Ludora Logo**: Include actual logo from `/assets/images/logo.png`
- **Layout Adaptation**: Content arranged horizontally to fit landscape format

**Layout Structure**:
- Background: Same as portrait but adapted to landscape
- Main content area: Wider container optimized for landscape viewing
- Content arrangement: Horizontal layout with lock icon on left, text content on right
- Logo and URL: Bottom center

### 3. `preview-not-available-slide.pdf`

**Dimensions**: 800 × 600 points (Slide format - matches existing SVG slide)
**Usage**: Replace restricted pages in slide-sized PDF documents

**Content Requirements**:
- **Same content as other versions** but optimized for slide format
- **Hebrew Text**: "עמוד זה בקובץ מוגן ויהיה זמין לאחר הרכישה"
- **Ludora Logo**: Include actual logo from `/assets/images/logo.png`
- **Slide Styling**: Clean presentation slide appearance

**Layout Structure**:
- Background: Same pattern as others but sized for slide format
- Main content area: Slide-style container
- Content arrangement: Presentation-style layout with clear hierarchy
- Logo: Prominent but not overwhelming

## Hebrew Typography Requirements

### Font Selection
- **Primary Font**: Use Arial or system font with Hebrew support
- **Fallback Fonts**: Ensure Hebrew characters display correctly
- **Text Direction**: Right-to-left (RTL) for Hebrew content
- **Font Weights**: Bold for headlines, regular for body text

### Text Content
**Primary Hebrew Text**: "עמוד זה בקובץ מוגן ויהיה זמין לאחר הרכישה"

**Secondary Content** (Hebrew):
- Upgrade message: "שדרגו את החבילה שלכם לגישה מלאה"
- Website: "ludora.app"

## Logo Integration

### Logo Requirements
- **Source**: Use actual logo from `/assets/images/logo.png`
- **Size**: Proportional to placeholder size (approximately 60-80px width)
- **Position**: Bottom center of content area
- **Quality**: Maintain logo clarity and brand standards
- **Alternative**: If logo fails to load, use "LUDORA" text in brand colors

### Brand Colors
- **Primary Blue**: #007bff
- **Gray Text**: #6c757d
- **Light Gray**: #f8f9fa (backgrounds)
- **Border Gray**: #dee2e6

## Technical Implementation

### File Generation
Use the existing `scripts/generate-pdf-placeholder.js` approach but create three separate functions:

```javascript
async function generatePortraitPlaceholder() {
  // Create 595 × 842 PDF with Hebrew content
}

async function generateLandscapePlaceholder() {
  // Create 842 × 595 PDF with adapted layout
}

async function generateSlidePlaceholder() {
  // Create 800 × 600 PDF with slide styling
}
```

### Hebrew Text Rendering
```javascript
// Ensure proper Hebrew text support
const hebrewText = 'עמוד זה בקובץ מוגן ויהיה זמין לאחר הרכישה';

// Use proper font with Hebrew support
const font = await pdfDoc.embedFont(StandardFonts.Helvetica); // or Hebrew-compatible font

// Set RTL text direction if needed
page.drawText(hebrewText, {
  x: centerX,
  y: centerY,
  size: 24,
  font: font,
  color: rgb(0.29, 0.31, 0.32), // Dark gray
});
```

### Logo Embedding
```javascript
// Load and embed the actual Ludora logo
const logoPath = path.join(process.cwd(), 'assets', 'images', 'logo.png');
const logoImage = await pdfDoc.embedPng(fs.readFileSync(logoPath));

page.drawImage(logoImage, {
  x: logoX,
  y: logoY,
  width: logoWidth,
  height: logoHeight,
});
```

## File Naming Convention

- **Portrait**: `preview-not-available-portrait.pdf`
- **Landscape**: `preview-not-available-landscape.pdf` (update existing)
- **Slide**: `preview-not-available-slide.pdf`

## Validation Requirements

Before deployment, verify:
- [ ] All three files exist in `/assets/placeholders/`
- [ ] Hebrew text displays correctly in all files
- [ ] Ludora logo appears correctly in all files
- [ ] File dimensions match specifications exactly
- [ ] Visual consistency across all three formats
- [ ] File sizes are reasonable (< 5KB each)

## Integration Points

These files integrate with:
- `utils/pdfTemplateMerge.js` - Format detection and loading logic
- `detectDocumentFormat()` function - Format detection
- `loadPlaceholderPdf()` function - File loading based on format

## Example Usage

```javascript
// System automatically detects format and loads appropriate placeholder
const detectedFormat = detectDocumentFormat(templateSettings, originalPdf, variables);
// Returns: 'portrait-a4', 'landscape-a4', or 'svg-slide'

const placeholderPdf = await loadPlaceholderPdf(detectedFormat);
// Loads: preview-not-available-portrait.pdf, preview-not-available-landscape.pdf, or preview-not-available-slide.pdf
```