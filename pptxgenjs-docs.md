# Quickstart-guide

## Creating a presentation with the client web browser

// 1. Create a new Presentation
let pres = new PptxGenJS();

// 2. Add a Slide
let slide = pres.addSlide();

// 3. Add one or more objects (Tables, Shapes, Images, Text and Media) to the Slide
let textboxText = "Hello World from PptxGenJS!";
let textboxOpts = { x: 1, y: 1, color: "363636" };
slide.addText(textboxText, textboxOpts);

// 4. Save the Presentation
pres.writeFile({ fileName: "Hello-World.pptx" });

# Installation

## Node-based

npm install pptxgenjs


# Creating a Presentation
A "presentation" is a single .pptx file.

(See Saving Multiple Presentations for information on creating more than a one presentation at-a-time).

Angular/React, ES6, TypeScript, NodeJS
import pptxgen from "pptxgenjs";
let pres = new pptxgen();

# Presentation Options
Metadata
Metadata Properties
These optional metadata properties correspond to built-in PowerPoint document properties (visible under File > Info). They help describe the presentation’s content and ownership.

Name	Description
title	title shown in PowerPoint UI
author	presentation author
subject	presentation subject
company	company name
revision	revision number (as string)
Library Version
💡 You can also check the current PptxGenJS library version using the read-only version property

console.log(pptx.version); // e.g. "4.0.0"

Metadata Properties Examples
PptxGenJS uses ES6-style getters/setters.

pptx.title = 'My Awesome Presentation';
pptx.author = 'Brent Ely';
pptx.subject = 'Annual Report';
pptx.company = 'Computer Science Chair';
pptx.revision = '15';

Slide Layouts (Sizes)
Layout option applies to all slides in the current Presentation.

Slide Layout Syntax
pptx.layout = 'LAYOUT_NAME';

Standard Slide Layouts
Layout Name	Default	Layout Slide Size
LAYOUT_16x9	Yes	10 x 5.625 inches
LAYOUT_16x10	No	10 x 6.25 inches
LAYOUT_4x3	No	10 x 7.5 inches
LAYOUT_WIDE	No	13.3 x 7.5 inches
Custom Slide Layouts
You can create custom layouts of any size!

Use the defineLayout() method to create any size custom layout
Multiple layouts are supported. E.g.: create an 'A3' and 'A4', then use as desired
Custom Slide Layout Example
// Define new layout for the Presentation
pptx.defineLayout({ name:'A3', width:16.5, height:11.7 });

// Set presentation to use new layout
pptx.layout = 'A3';

🔍 Need to inspect the current layout size?

console.log(pptx.presLayout); // { width: 10, height: 5.625 }

Text Direction
Text Direction Options
Right-to-Left (RTL) text is supported. Simply set the RTL mode presentation property.

Text Direction Examples
pptx.rtlMode = true; // set RTL text mode to true
pptx.theme = { lang: "he" }; // set RTL language to use (default is 'EN-US')

Notes:

You may also need to set an RTL lang value such as lang='he' as the default lang is 'EN-US'
See Issue#600 for more
Default Font
Default Font Options
Use the headFontFace and bodyFontFace properties to set the default font used in the presentation.

Default Font Examples
pptx.theme = { headFontFace: "Arial Light" };
pptx.theme = { bodyFontFace: "Arial" };

# Adding a Slide
Syntax
Create a new slide in the presentation:

let slide = pptx.addSlide();

Returns
The addSlide() method returns a reference to the created Slide object, so method calls can be chained.

let slide1 = pptx.addSlide();
slide1
  .addImage({ path: "img1.png", x: 1, y: 2 })
  .addImage({ path: "img2.jpg", x: 5, y: 3 });

You can also create multiple slides:

let slide1 = pptx.addSlide();
slide1.addText("Slide One", { x: 1, y: 1 });

let slide2 = pptx.addSlide();
slide2.addText("Slide Two", { x: 1, y: 1 });

Slide Methods
See Slide Methods for features such as Background and Slide Numbers.

Slide Masters
Want to use a layout with predefined logos, margins, or styles? See Slide Masters to learn how to create and apply slide masters.

# Slide Properties and Methods
Slide Properties
Option	Type	Default	Description	Possible Values
background	BackgroundProps	FFFFFF	background color/images	add background color or image DataOrPathProps and/or ShapeFillProps
color	string	000000	default text color	hex color or scheme color.
hidden	boolean	false	whether slide is hidden	Ex: slide.hidden = true
newAutoPagedSlides	PresSlide[]		all slides created by autopaging	Contains slides automatically created when content (e.g. a table) overflows the current slide using autoPage:true
slideNumber	SlideNumberProps		slide number props	(see examples below)
Full Examples
Example: Background/Foreground
// EX: Use several methods to set a background
slide.background = { color: "F1F1F1" }; // Solid color
slide.background = { color: "FF3399", transparency: 50 }; // hex fill color with transparency of 50%
slide.background = { data: "image/png;base64,ABC[...]123" }; // image: base64 data
slide.background = { path: "https://some.url/image.jpg" }; // image: url

// EX: Set slide default font color
slide.color = "696969";

Example: Slide Number
// EX: Add a Slide Number at a given location
slide.slideNumber = { x: 1.0, y: "90%" };

// EX: Styled Slide Numbers
slide.slideNumber = { x: 1.0, y: "95%", fontFace: "Courier", fontSize: 32, color: "CF0101" };

# Saving Presentations
Several methods are available when generating a presentation.

All methods return a Promise
Working examples are available under /PptxGenJS/demos
Saving as a File (writeFile)
Save the presentation as a PowerPoint .pptx file.

In browser-based apps, this triggers a download using the correct pptx MIME-type.
In Node.js, it saves to disk via the native fs module.
Write File Props (WriteFileProps)
Option	Type	Default	Description
compression	boolean	false	apply zip compression (exports take longer but saves signifcant space)
fileName	string	'Presentation.pptx'	output filename
Write File Example
// For simple cases, you can omit `then`
pptx.writeFile({ fileName: 'Browser-PowerPoint-Demo.pptx' });

// Using Promise to determine when the file has actually completed generating
pptx.writeFile({ fileName: 'Browser-PowerPoint-Demo.pptx' });
    .then(fileName => {
        console.log(`created file: ${fileName}`);
    });

Generating Other Formats (write)
Generate the presentation in various formats (e.g., base64, arraybuffer) — useful for uploading to cloud storage or handling in-memory.

Write Props (WriteProps)
Option	Type	Default	Description
compression	boolean	false	apply zip compression (exports take longer but save significant space)
outputType	string	blob	'arraybuffer', 'base64', 'binarystring', 'blob', 'nodebuffer', 'uint8array'
Write Output Types
outputType	Description
blob	Default for browsers
arraybuffer	Often used with WebAssembly or binary tools
base64	Useful for uploads to APIs like Google Drive
nodebuffer	Use in Node.js with fs.writeFile()
Write Example
pptx.write({ outputType: "base64" })
    .then((data) => {
        console.log("write as base64: Here are 0-100 chars of `data`:\n");
        console.log(data.substring(0, 100));
    })
    .catch((err) => {
        console.error(err);
    });

Streaming in Node.js (stream)
Returns the presentation as a binary string, suitable for streaming in HTTP responses or writing directly to disk in Node.js environments.

Stream Example
// SRC: https://github.com/gitbrent/PptxGenJS/blob/master/demos/node/demo_stream.js
// HOW: using: `const app = express();``
pptx.stream()
    .then((data) => {
        app.get("/", (req, res) => {
            res.writeHead(200, { "Content-disposition": "attachment;filename=" + fileName, "Content-Length": data.length });
            res.end(new Buffer(data, "binary"));
        });
        app.listen(3000, () => {
            console.log("PptxGenJS Node Stream Demo app listening on port 3000!");
            console.log("Visit: http://localhost:3000/");
            console.log("(press Ctrl-C to quit demo)");
        });
    })
    .catch((err) => {
        console.log("ERROR: " + err);
    });


Saving Multiple Presentations
In the Browser
Each new presentation should use a fresh new PptxGenJS() instance to avoid reusing slides or metadata.

let pptx = null;

// Presentation 1:
pptx = new PptxGenJS();
pptx.addSlide().addText("Presentation 1", { x: 1, y: 1 });
pptx.writeFile({ fileName: "PptxGenJS-Browser-1" });

// Presentation 2:
pptx = new PptxGenJS();
pptx.addSlide().addText("Presentation 2", { x: 1, y: 1 });
pptx.writeFile({ fileName: "PptxGenJS-Browser-2" });

In Node.js
See demos/node/demo.js for a working demo with multiple presentations, promises, etc.
See demos/node/demo_stream.js for a working demo using streaming
import pptxgen from "pptxgenjs";

// Presentation 1:
let pptx1 = new pptxgen();
pptx1.addSlide().addText("Presentation 1", { x: 1, y: 1 });
pptx1.writeFile({ fileName: "PptxGenJS-NodePres-1" });

// Presentation 2:
let pptx2 = new pptxgen();
pptx2.addSlide().addText("Presentation 2", { x: 1, y: 1 });
pptx2.writeFile({ fileName: "PptxGenJS-NodePres-2" });

# HTML to PowerPoint
Reproduces an HTML table into 1 or more slides (auto-paging).

Supported cell styling includes background colors, borders, fonts, padding, etc.
Slide margin settings can be set using options, or by providing a Master Slide definition
Notes:

CSS styles are only supported down to the cell level (word-level formatting is not supported)
Nested tables are not supported in PowerPoint, therefore they cannot be reproduced (only the text will be included)
HTML to PowerPoint Syntax
slide.tableToSlides(htmlElementID);
slide.tableToSlides(htmlElementID, { OPTIONS });

HTML to PowerPoint Options (ITableToSlidesOpts)
Option	Type	Default	Description	Possible Values
x	number	1.0	horizontal location (inches)	0-256. Table will be placed here on each Slide
y	number	1.0	vertical location (inches)	0-256. Table will be placed here on each Slide
w	number	100%	width (inches)	0-256.
h	number	100%	height (inches)	0-256.
addHeaderToEach	boolean	false	add table headers to each slide	Ex: {addHeaderToEach: true}
addImage	string		add an image to each slide	Ex: {addImage: {image: {path: "images/logo.png"}, options: {x: 1, y: 1, w: 1, h: 1}}}
addShape	string		add a shape to each slide	Use the established syntax
addTable	string		add a table to each slide	Use the established syntax
addText	string		add text to each slide	Use the established syntax
autoPage	boolean	true	create new slides when content overflows	Ex: {autoPage: false}
autoPageCharWeight	number	0.0	character weight used to determine when lines wrap	-1.0 to 1.0. Ex: {autoPageCharWeight: 0.5}
autoPageLineWeight	number	0.0	line weight used to determine when tables wrap	-1.0 to 1.0. Ex: {autoPageLineWeight: 0.5}
colW	number		table column widths	Array of column widths. Ex: {colW: [2.0, 3.0, 1.0]}
masterSlideName	string		master slide to use	Slide Masters name. Ex: {master: 'TITLE_SLIDE'}
newSlideStartY	number		starting location on Slide after initial	0-(slide height). Ex: {newSlideStartY:0.5}
slideMargin	number	1.0	margins to use on Slide	Use a number for same TRBL, or use array. Ex: {margin: [1.0,0.5,1.0,0.5]}
HTML to PowerPoint Table Options
Add an data attribute to the table's <th> tag to manually size columns (inches)

minimum column width can be specified by using the data-pptx-min-width attribute
fixed column width can be specified by using the data-pptx-width attribute
Example:

<table id="tabAutoPaging" class="tabCool">
  <thead>
    <tr>
      <th data-pptx-min-width="0.6" style="width: 5%">Row</th>
      <th data-pptx-min-width="0.8" style="width:10%">Last Name</th>
      <th data-pptx-min-width="0.8" style="width:10%">First Name</th>
      <th data-pptx-width="8.5"     style="width:75%">Description</th>
    </tr>
  </thead>
  <tbody></tbody>
</table>

HTML to PowerPoint Notes
Your Master Slides should already have defined margins, so a Master Slide name is the only option you'll need most of the time
Hidden tables wont auto-size their columns correctly (as the properties are not accurate)
HTML to PowerPoint Examples
// Pass table element ID to tableToSlides function to produce 1-N slides
pptx.tableToSlides("myHtmlTableID");

// Optionally, include a Master Slide name for pre-defined margins, background, logo, etc.
pptx.tableToSlides("myHtmlTableID", { master: "MASTER_SLIDE" });

// Optionally, add images/shapes/text/tables to each Slide
pptx.tableToSlides("myHtmlTableID", {
  addText: { text: "Dynamic Title", options: { x: 1, y: 0.5, color: "0088CC" } },
});
pptx.tableToSlides("myHtmlTableID", {
  addImage: { path: "images/logo.png", x: 10, y: 0.5, w: 1.2, h: 0.75 },
});

HTML Table
HTML-to-PowerPoint Table

Resulting Slides
HTML-to-PowerPoint Presentation

Demos
Working example is available under /demos
HTML to PowerPoint Creative Solutions
Design a Master Slide that already contains: slide layout, margins, logos, etc., then you can produce professional looking Presentations with a single line of code which can be embedded into a link or a button:

Add a button to a webpage that will create a Presentation using whatever table data is present:

<button onclick="{ var pptx=new PptxGenJS(); pptx.tableToSlides('tableId'); pptx.writeFile(); }" type="button">Export to PPTX</button>


SharePoint Integration
Placing a button like this into a WebPart is a great way to add "Export to PowerPoint" functionality to SharePoint. (You'd also need to add the PptxGenJS bundle <script> in that/another WebPart)

# Masters and Placeholders
Slide Masters
Generating sample slides like those shown in the Examples section are great for demonstrating library features, but the reality is most of us will be required to produce presentations that have a certain design or corporate branding.

PptxGenJS allows you to define Slide Master Layouts via objects that can then be used to provide branding functionality. This enables you to easily create a Master Slide using code.

Slide Masters are created by calling the defineSlideMaster() method along with an options object (same style used in Slides). Once defined, you can pass the Master title to addSlide() and that Slide will use the Layout previously defined. See the demo under /examples for several working examples.

The defined Masters become first-class Layouts in the exported PowerPoint presentation and can be changed via View > Slide Master and will affect the Slides created using that layout.

Properties
Slide Master Props (SlideMasterProps)
Option	Type	Reqd?	Description	Possible Values
title	string	Y	Layout title/name	unique name for this Master
background	BackgroundProps		background props	(see Background Props)
margin	number		Slide margins	(inches) 0.0 through Slide.width
margin	array		Slide margins	(inches) array of numbers in TRBL order. Ex: [0.5, 0.75, 0.5, 0.75]
objects	array		Objects for Slide	object with type and options.
slideNumber	SlideNumberProps		Slide numbers	(see SlideNumber Props)
Background Props (BackgroundProps)
Option	Type	Default	Description	Possible Values
color	string	000000	color	hex color code or scheme color constant. Ex: {line:'0088CC'}
transparency	number	0	transparency	Percentage: 0-100
SlideNumber Props (SlideNumberProps)
Option	Type	Default	Description	Possible Values
x	number	1.0	horizontal location (inches)	0-n OR 'n%'. (Ex: {x:'50%'} will place object in the middle of the Slide)
y	number	1.0	vertical location (inches)	0-n OR 'n%'.
w	number		width (inches)	0-n OR 'n%'. (Ex: {w:'50%'} will make object 50% width of the Slide)
h	number		height (inches)	0-n OR 'n%'.
align	string	left	alignment	left or center or right
color	string	000000	color	hex color code or scheme color constant. Ex: {line:'0088CC'}
NOTES
Slide Number: more props are available that shown above - SlideNumberProps inherits from TextProps
Pre-encode your images (base64) and add the string as the optional data key/val (see bkgd above)
Examples
Slide Master Example
let pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";

pptx.defineSlideMaster({
 title: "MASTER_SLIDE",
 background: { color: "FFFFFF" },
 objects: [
  { line: { x: 3.5, y: 1.0, w: 6.0, line: { color: "0088CC", width: 5 } } },
  { rect: { x: 0.0, y: 5.3, w: "100%", h: 0.75, fill: { color: "F1F1F1" } } },
  { text: { text: "Status Report", options: { x: 3.0, y: 5.3, w: 5.5, h: 0.75 } } },
  { image: { x: 11.3, y: 6.4, w: 1.67, h: 0.75, path: "images/logo.png" } },
 ],
 slideNumber: { x: 0.3, y: "90%" },
});

let slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide.addText("How To Create PowerPoint Presentations with JavaScript", { x: 0.5, y: 0.7, fontSize: 18 });

pptx.writeFile();


Slide Master Example Output
Using the 'MASTER_SLIDE' defined above to produce a Slide: Master Slide Demo Presentation

Placeholders
Placeholders are supported in PptxGenJS.

Add a placeholder object to a Master Slide using a unique name, then reference that placeholder name when adding text or other objects.

Placeholder Types
Type	Description
title	slide title
body	body area
image	image
chart	chart
table	table
media	audio/video
Placeholder Example
let pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";

pptx.defineSlideMaster({
 title: "PLACEHOLDER_SLIDE",
 background: { color: "FFFFFF" },
 objects: [
  { rect: { x: 0, y: 0, w: "100%", h: 0.75, fill: { color: "F1F1F1" } } },
  { text: { text: "Status Report", options: { x: 0, y: 0, w: 6, h: 0.75 } } },
  {
   placeholder: {
    options: { name: "body", type: "body", x: 0.6, y: 1.5, w: 12, h: 5.25 },
    text: "(custom placeholder text!)",
   },
  },
 ],
 slideNumber: { x: 0.3, y: "95%" },
});

let slide = pptx.addSlide({ masterName: "PLACEHOLDER_SLIDE" });

// Add text, charts, etc. to any placeholder using its `name`
slide.addText("Body Placeholder here!", { placeholder: "body" });

pptx.writeFile();

Placeholder Example Output
Using the 'PLACEHOLDER_SLIDE' defined above to produce a Slide: Placeholder Demo Presentation

More Examples and Demos
There are several Master Slides defined in the Demo: demos/browser/index.html including examples using placeholders. PptxGenJS Master Slide Demo

# Slide Sections
Group slides using sections.

Syntax
pptx.addSection({ title: "Tables" });
pptx.addSection({ title: "Tables", order: 3 });

Section Options
Option	Type	Description	Possible Values
title	string	section title	0-n OR 'n%'. (Ex: {x:'50%'} will place object in the middle of the Slide)
order	integer	section order	1-n. Used to add section at any index
Section Example
import pptxgen from "pptxgenjs";
let pptx = new pptxgen();

// STEP 1: Create a section
pptx.addSection({ title: "Tables" });

// STEP 2: Provide section title to a slide that you want in corresponding section
let slide = pptx.addSlide({ sectionTitle: "Tables" });

slide.addText("This slide is in the Tables section!", { x: 1.5, y: 1.5, fontSize: 18, color: "363636" });
pptx.writeFile({ fileName: "Section Sample.pptx" });

# Shapes and Schemes
PowerPoint Shape Types
The library comes with over 180 built-in PowerPoint shapes (thanks to officegen project).

Use inline typescript definitions to view available shapes
or see ShapeType in index.d.ts for the complete list
PowerPoint Scheme Colors
Scheme color is a variable that changes its value whenever another scheme palette is selected. Using scheme colors, design consistency can be easily preserved throughout the presentation and viewers can change color theme without any text/background contrast issues.

Use inline typescript definitions to view available colors
or see SchemeColor in index.d.ts for the complete list
To use a scheme color, set a color constant as a property value:

slide.addText("Scheme Color 'text1'", { color: pptx.SchemeColor.text1 });

See the Shapes Demo for Scheme Colors demo

Scheme Demo

export enum SchemeColor {
    "text1" = "tx1",
    "text2" = "tx2",
    "background1" = "bg1",
    "background2" = "bg2",
    "accent1" = "accent1",
    "accent2" = "accent2",
    "accent3" = "accent3",
    "accent4" = "accent4",
    "accent5" = "accent5",
    "accent6" = "accent6",
}

# Speaker Notes
Speaker Notes can be included on any Slide.

Syntax
slide.addNotes('TEXT');

Example: JavaScript
let pres = new PptxGenJS();
let slide = pptx.addSlide();

slide.addText('Hello World!', { x:1.5, y:1.5, fontSize:18, color:'363636' });

slide.addNotes('This is my favorite slide!');

pptx.writeFile('Sample Speaker Notes');

Example: TypeScript
import pptxgen from "pptxgenjs";

let pres = new pptxgen();
let slide = pptx.addSlide();

slide.addText('Hello World!', { x:1.5, y:1.5, fontSize:18, color:'363636' });

slide.addNotes('This is my favorite slide!');

pptx.writeFile('Sample Speaker Notes');

# Type Interfaces
The PptxGenJS interfaces referenced in surrounding documentation. See the complete list on GitHub.

Position Props (PositionProps)
Name	Type	Default	Description	Possible Values
x	number	1.0	hor location (inches)	0-n
x	string		hor location (percent)	'n%'. (Ex: {x:'50%'} middle of the Slide)
y	number	1.0	ver location (inches)	0-n
y	string		ver location (percent)	'n%'. (Ex: {y:'50%'} middle of the Slide)
w	number	1.0	width (inches)	0-n
w	string		width (percent)	'n%'. (Ex: {w:'50%'} 50% the Slide width)
h	number	1.0	height (inches)	0-n
h	string		height (percent)	'n%'. (Ex: {h:'50%'} 50% the Slide height)
Data/Path Props (DataOrPathProps)
Name	Type	Description	Possible Values
data	string	image data (base64)	base64-encoded image string. (either data or path is required)
path	string	image path	Same as used in an (img src="") tag. (either data or path is required)
Hyperlink Props (HyperlinkProps)
Name	Type	Description	Possible Values
slide	number	link to a given slide	Ex: 2
tooltip	string	link tooltip text	Ex: Click to visit home page
url	string	target URL	Ex: https://wikipedia.org
Image Props (ImageProps)
Option	Type	Default	Description	Possible Values
hyperlink	HyperlinkProps		add hyperlink	object with url or slide
placeholder	string		image placeholder	Placeholder location: title, body
rotate	integer	0	rotation (degrees)	Rotation degress: 0-359
rounding	boolean	false	image rounding	Shapes an image into a circle
sizing	object		transforms image	See Image Sizing
Media Props (MediaProps)
Option	Type	Description	Possible Values
type	string	media type	media type: audio or video (reqs: data or path) or online (reqs:link)
link	string	video URL	(YouTube only): link to online video
Shadow Props (ShadowProps)
Name	Type	Default	Description	Possible Values
type	string	none	shadow type	outer, inner, none
angle	number	0	blue degrees	0-359
blur	number	0	blur range (points)	0-100
color	string	000000	color	hex color code
offset	number	0	shadow offset (points)	0-200
opacity	number	0	opacity percentage	0.0-1.0
Shape Props (ShapeProps)
Name	Type	Description	Possible Values
align	string	alignment	left or center or right. Default: left
fill	ShapeFillProps	fill props	Fill color/transparency props
flipH	boolean	flip Horizontal	true or false
flipV	boolean	flip Vertical	true or false
hyperlink	HyperlinkProps	hyperlink props	(see type link)
line	ShapeLineProps	border line props	(see type link)
rectRadius	number	rounding radius	0-180. (only for pptx.shapes.ROUNDED_RECTANGLE)
rotate	number	rotation (degrees)	-360 to 360. Default: 0
shadow	ShadowProps	shadow props	(see type link)
shapeName	string	optional shape name	Ex: "Customer Network Diagram 99"
Shape Fill Props (ShapeFillProps)
Name	Type	Default	Description	Possible Values
color	string	000000	fill color	hex color or scheme color.
transparency	number	0	transparency	transparency percentage: 0-100
type	string	solid	fill type	shape fill type
Shape Line Props (ShapeLineProps)
Name	Type	Default	Description	Possible Values
beginArrowType	string		line ending	arrow, diamond, oval, stealth, triangle or none
color	string		line color	hex color or scheme color. Ex: {line:'0088CC'}
dashType	string	solid	line dash style	dash, dashDot, lgDash, lgDashDot, lgDashDotDot, solid, sysDash or sysDot
endArrowType	string		line heading	arrow, diamond, oval, stealth, triangle or none
transparency	number	0	line transparency	Percentage: 0-100
width	number	1	line width (points)	1-256. Ex: { width:4 }
Slide Number Props (SlideNumberProps)
Option	Type	Default	Description	Possible Values
color	string	000000	color	hex color or scheme color.
fontFace	string		font face	any available font. Ex: { fontFace:'Arial' }
fontSize	number		font size	8-256. Ex: { fontSize:12 }
Text Underline Props (TextUnderlineProps)
Name	Type	Description	Possible Values
color	string	underline color	hex color or scheme color.
style	string	underline style	dash, dashHeavy, dashLong, dashLongHeavy, dbl, dotDash, dotDashHeave, dotDotDash, dotDotDashHeavy, dotted, dottedHeavy, heavy, none, sng, wavy , wavyDbl, wavyHeavy

# Charts
Charts of almost any type can be added to Slides, including combo and 3D charts. See demos/modules/demo_chart.mjs for the working code used to create the charts shown below.

PptxGenJS Chart Samples

Usage
let pres = new pptxgen();
let dataChartAreaLine = [
  {
    name: "Actual Sales",
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    values: [1500, 4600, 5156, 3167, 8510, 8009, 6006, 7855, 12102, 12789, 10123, 15121],
  },
  {
    name: "Projected Sales",
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    values: [1000, 2600, 3456, 4567, 5010, 6009, 7006, 8855, 9102, 10789, 11123, 12121],
  },
];

slide.addChart(pres.ChartType.line, dataChartAreaLine, { x: 1, y: 1, w: 8, h: 4 });

Core Chart Types
Chart type can be any one of pptx.ChartType
Currently: pptx.ChartType.area, pptx.ChartType.bar, pptx.ChartType.bar3d, pptx.ChartType.bubble, pptx.ChartType.bubble3d, pptx.ChartType.doughnut, pptx.ChartType.line, pptx.ChartType.pie, pptx.ChartType.radar, pptx.ChartType.scatter
Combo Charts
Chart types can be any one of pptx.ChartType, although pptx.ChartType.area, pptx.ChartType.bar, and pptx.ChartType.line will give the best results.
There should be at least two chart-types. There should always be two value axes and category axes.
Combo charts have a different function signature than standard. There are two parameters:
chartTypes: Array of objects, each with type, data, and options objects.
options: Standard options as used with single charts. Can include axes options.
Columns makes the most sense in general. Line charts cannot be rotated to match up with horizontal bars (a PowerPoint limitation).
Can optionally have a secondary value axis.
If there is secondary value axis, a secondary category axis is required in order to render, but currently always uses the primary labels. It is recommended to use catAxisHidden: true on the secondary category axis.
Standard options are used, and the chart-type-options are mixed in to each.
Usage Notes
Zero values can be hidden using Microsoft formatting specs (see Issue #288)
Use *LabelFormatCode props to format numbers - see Microsoft Number Format Codes
Examples: The demos/modules/demo_chart.mjs file has 17 slides of well-documented chart examples
Properties
Position/Size Props (PositionProps)
Option	Type	Default	Description	Possible Values
x	number	1.0	hor location (inches)	0-n
x	string		hor location (percent)	'n%'. (Ex: {x:'50%'} middle of the Slide)
y	number	1.0	ver location (inches)	0-n
y	string		ver location (percent)	'n%'. (Ex: {y:'50%'} middle of the Slide)
w	number	1.0	width (inches)	0-n
w	string		width (percent)	'n%'. (Ex: {w:'50%'} 50% the Slide width)
h	number	1.0	height (inches)	0-n
h	string		height (percent)	'n%'. (Ex: {h:'50%'} 50% the Slide height)
General (IChartOpts), Data Table (IChartPropsDataTable), Legend (IChartPropsLegend), Title (IChartPropsTitle)
Option	Type	Default	Description	Possible Values
altText	string		chart alt text	string shown in the "alt text" panel in PowerPoint
chartArea	object		chart area fill/border	fill and/or border. Ex: { fill: { color:"0088CC" }, border: {pt:'1', color:'f1f1f1'}, roundedCorners:true }
chartColors	array		data colors	array of hex color codes. Ex: ['0088CC','FFCC00']
chartColorsOpacity	number	100	data color opacity (percent)	1-100. Ex: { chartColorsOpacity:50 }
dataTableFontSize	number		data table font size	1-256. Ex: { dataTableFontSize: 13 }
holeSize	number	50	doughnut hole size (percent)	1-100. Ex: { holeSize:50 }
invertedColors	array		data colors for negative numbers	array of hex color codes. Ex: ['0088CC','FFCC00']
legendFontFace	string	Arial	font face	font name. Ex: { legendFontFace:'Arial' }
legendFontSize	number	10	legend font size	1-256. Ex: { legendFontSize: 13 }
legendColor	string	000000	legend text color	hex color code. Ex: { legendColor: '0088CC' }
legendPos	string	r	chart legend position	b (bottom), tr (top-right), l (left), r (right), t (top)
layout	object		positioning plot within chart area	object with x, y, w and h props, all in range 0-1 (proportionally related to the chart size). Ex: {x: 0, y: 0, w: 1, h: 1} fully expands chart within the plot area
plotArea	object		plot area fill/border	fill and/or border. Ex: { fill: { color: "0088CC" }, border: {pt:'1', color:'f1f1f1'} }
radarStyle	string	standard	radar chart style	standard, marker, filled
showDataTable	boolean	false	show Data Table under the chart	true or false (Not available for Pie/Doughnut charts)
showDataTableKeys	boolean	true	show Data Table Keys (color blocks)	true or false (Not available for Pie/Doughnut charts)
showDataTableHorzBorder	boolean	true	show Data Table horizontal borders	true or false (Not available for Pie/Doughnut charts)
showDataTableVertBorder	boolean	true	show Data Table vertical borders	true or false (Not available for Pie/Doughnut charts)
showDataTableOutline	boolean	true	show Data Table table outline	true or false (Not available for Pie/Doughnut charts)
showLabel	boolean	false	show data labels	true or false
showLeaderLines	boolean	false	show leader lines	true or false
showLegend	boolean	false	show chart legend	true or false
showPercent	boolean	false	show data percent	true or false
showTitle	boolean	false	show chart title	true or false
showValue	boolean	false	show data values	true or false
title	string		chart title	Ex: { title:'Sales by Region' }
titleAlign	string	center	chart title text align	left center or right Ex: { titleAlign:'left' }
titleColor	string	000000	title color	hex color code. Ex: { titleColor:'0088CC' }
titleFontFace	string	Arial	font face	font name. Ex: { titleFontFace:'Arial' }
titleFontSize	number	18	font size	1-256. Ex: { titleFontSize:12 }
titlePos	object		title position	object with x and y values. Ex: { titlePos:{x: 0, y: 10} }
titleRotate	integer		title rotation (degrees)	0-359. Ex: { titleRotate:45 }
Cat Axis (IChartPropsAxisCat) and Val Axis (IChartPropsAxisVal)
Option	Type	Default	Description	Possible Values
catAxisBaseTimeUnit	string		category-axis base time unit	days months or years
catAxisCrossesAt	multi		category-axis crosses at	number or autoZero
catAxisHidden	boolean	false	hide category-axis	true or false
catAxisLabelColor	string	000000	category-axis color	hex color code. Ex: { catAxisLabelColor:'0088CC' }
catAxisLabelFontBold	boolean	false	make cat axis label bold	true or false
catAxisLabelFontFace	string	Arial	category-axis font face	font name. Ex: { titleFontFace:'Arial' }
catAxisLabelFontSize	integer	18	category-axis font size	1-256. Ex: { titleFontSize:12 }
catAxisLabelFrequency	integer		PPT "Interval Between Labels"	1-n. Ex: { catAxisLabelFrequency: 2 }
catAxisLabelPos	string	nextTo	category-axis label position	low, high, or nextTo . Ex: { catAxisLabelPos: 'low' }
catAxisLabelRotate	integer		category-axis rotation (degrees)	0-360. Ex: { catAxisLabelRotate:45 }
catAxisLineColor	string	000000	category-axis line color	hex color code. Ex: { catAxisTitleColor:'0088CC' }
catAxisLineShow	boolean	true	show/hide category-axis line	true or false
catAxisLineSize	integer	18	category-axis font size	1-256. Ex: { titleFontSize:12 }
catAxisLineStyle	string	solid	category-axis line style	solid, dash, dot
catAxisMajorTickMark	string		category-axis major tick mark	none, inside, outside, cross
catAxisMajorTimeUnit	string		category-axis major time unit	days, months or years
catAxisMaxVal	integer		category-axis max value	Integer. Ex: { catAxisMaxVal:10 }
catAxisMinVal	integer		category-axis min value	Integer. Ex: { catAxisMinVal:0 }
catAxisMinorTickMark	string		category-axis minor tick mark	none, inside, outside, cross
catAxisMinorTimeUnit	string		category-axis minor time unit	days, months or years
catAxisMajorUnit	integer		category-axis major unit	Positive integer. Ex: { catAxisMajorUnit:12 }
catAxisMinorUnit	integer		category-axis minor unit	Positive integer. Ex: { catAxisMinorUnit:1 }
catAxisMultiLevelLabels	boolean	false	show multi-level labels	true or false. Ex:{ catAxisMultiLevelLabels:true }
catAxisOrientation	string	minMax	category-axis orientation	maxMin (high->low) or minMax (low->high)
catAxisTitle	string	Axis Title	axis title	a string. Ex: { catAxisTitle:'Regions' }
catAxisTitleColor	string	000000	title color	hex color code. Ex: { catAxisTitleColor:'0088CC' }
catAxisTitleFontFace	string	Arial	font face	font name. Ex: { catAxisTitleFontFace:'Arial' }
catAxisTitleFontSize	integer		font size	1-256. Ex: { catAxisTitleFontSize:12 }
catAxisTitleRotate	integer		title rotation (degrees)	0-360. Ex: { catAxisTitleRotate:45 }
catGridLine	object	none	category grid line style	object with properties size (pt), color and style ('solid', 'dash' or 'dot') or 'none' to hide
showCatAxisTitle	boolean	false	show category (vert) title	true or false. Ex:{ showCatAxisTitle:true }
showSerName	boolean	false	show serie name	true or false. Ex:{ showSerName:true }
showValAxisTitle	boolean	false	show values (horiz) title	true or false. Ex:{ showValAxisTitle:true }
valAxisCrossesAt	multi		value-axis crosses at	number or autoZero
valAxisDisplayUnit	string		display units	billions, hundredMillions, hundreds, hundredThousands, millions, tenMillions, tenThousands, thousands, trillions
valAxisHidden	boolean	false	hide value-axis	true or false
valAxisLabelColor	string	000000	value-axis color	hex color code. Ex: { valAxisLabelColor:'0088CC' }
valAxisLabelFontBold	boolean	false	make val axis label bold	true or false
valAxisLabelFontFace	string	Arial	value-axis font face	font name. Ex: { titleFontFace:'Arial' }
valAxisLabelFontSize	integer	18	value-axis font size	1-256. Ex: { titleFontSize:12 }
valAxisLabelFormatCode	string	General	value-axis number format	format string. Ex: { axisLabelFormatCode:'#,##0' }
valAxisLineColor	string	000000	value-axis line color	hex color code. Ex: { catAxisTitleColor:'0088CC' }
valAxisLineShow	boolean	true	show/hide value-axis line	true or false
valAxisLineSize	integer	18	value-axis font size	1-256. Ex: { titleFontSize:12 }
valAxisLineStyle	string	solid	value-axis line style	solid, dash, dot
valAxisLogScaleBase	number		logarithmic scale	2-99
valAxisMajorTickMark	string		value-axis major tick mark	none, inside, outside, cross
valAxisMajorUnit	number	1.0	value-axis tick steps	Float or whole number. Ex: { majorUnit:0.2 }
valAxisMaxVal	number		value-axis maximum value	1-N. Ex: { valAxisMaxVal:125 }
valAxisMinVal	number		value-axis minimum value	1-N. Ex: { valAxisMinVal: -10 }
valAxisMinorTickMark	string		value-axis minor tick mark	none, inside, outside, cross
valAxisOrientation	string	minMax	value-axis orientation	maxMin (high->low) or minMax (low->high)
valAxisTitle	string	Axis Title	axis title	a string. Ex: { valAxisTitle:'Sales (USD)' }
valAxisTitleColor	string	000000	title color	hex color code. Ex: { valAxisTitleColor:'0088CC' }
valAxisTitleFontFace	string	Arial	font face	font name. Ex: { valAxisTitleFontFace:'Arial' }
valAxisTitleFontSize	number		font size	1-256. Ex: { valAxisTitleFontSize:12 }
valAxisTitleRotate	integer		title rotation (degrees)	0-360. Ex: { valAxisTitleRotate:45 }
valGridLine	object		value grid line style	object with properties size (pt), color and style ('solid', 'dash' or 'dot') or 'none' to hide
Bar (IChartPropsChartBar), Data Label (IChartPropsDataLabel), Line (IChartPropsChartLine)
Option	Type	Default	Description	Possible Values
barDir	string	col	bar direction	(Bar Chart) bar (horizontal) or col (vertical). Ex: {barDir:'bar'}
barGapWidthPct	number	150	width between bar groups (percent)	(Bar Chart) 0-500. Ex: { barGapWidthPct:50 }
barGrouping	string	clustered	bar grouping	(Bar Chart) clustered or stacked or percentStacked.
barOverlapPct	number	0	overlap (percent)	(Bar Chart) -100-100. Ex: { barOverlapPct:50 }
catLabelFormatCode	string		format to show data value	format string. Ex: { catLabelFormatCode:'#,##0' }
dataBorder	object		data border	object with pt and color values. Ex: border:{pt:'1', color:'f1f1f1'}
dataLabelColor	string	000000	data label color	hex color code. Ex: { dataLabelColor:'0088CC' }
dataLabelFormatCode	string		format to show data value	format string. Ex: { dataLabelFormatCode:'#,##0' }
dataLabelFormatScatter	string	custom	label format	(Scatter Chart) custom,customXY,XY
dataLabelFontBold	boolean	false	make data label bold	Ex: { dataLabelFontBold:true }
dataLabelFontFace	string	Arial	value-axis font face	font name. Ex: { titleFontFace:'Arial' }
dataLabelFontSize	number	18	value-axis font size	1-256. Ex: { titleFontSize:12 }
dataLabelPosition	string	bestFit	data label position	bestFit,b,ctr,inBase,inEnd,l,outEnd,r,t
dataNoEffects	boolean	false	whether to omit effects on data	(Doughnut/Pie Charts) true or false
displayBlanksAs	string	span	whether to draw line or gap	(Line Charts) span or gap
lineCap	string		line cap style	flat, round, square
lineDash	string	solid	(Bar/Scatter Chart) border line dash style	dash, dashDot, lgDash, lgDashDot, lgDashDotDot, solid, sysDash or sysDot
lineDataSymbol	string	circle	symbol used on line marker	circle,dash,diamond,dot,none,square,triangle
lineDataSymbolSize	number	6	size of line data symbol	1-256. Ex: { lineDataSymbolSize:12 }
lineDataSymbolLineSize	number	0.75	size of data symbol outline	1-256. Ex: { lineDataSymbolLineSize:12 }
lineDataSymbolLineColor	string	000000	color of data symbol line	hex color code. Ex: { lineDataSymbolLineColor:'0088CC' }
lineSize	number	2	thickness of data line (0 is no line)	0-256. Ex: { lineSize: 1 }
lineSmooth	boolean	false	whether to smooth lines	true or false - Ex: { lineSmooth: true }
shadow	ShadowProps		data element shadow options	none or ShadowProps
3D Bar Chart (IChartPropsChartBar), Series Axis (IChartPropsDataTable)
Option	Type	Default	Description	Possible Values
bar3DShape	string	box	bar 3d shape	box, cylinder, coneToMax, pyramid, pyramidToMax
barGapDepthPct	number	150	width between bar groups (percent)	0-500. Ex: { barGapWidthPct:50 }
dataLabelBkgrdColors	boolean	false	bkgd color is series color	true or false
serAxisBaseTimeUnit	string		series-axis base time unit	days months or years
serAxisHidden	boolean	false	hide series-axis	true or false
serAxisOrientation	string	minMax	series-axis orientation	maxMin (high->low) or minMax (low->high)
serAxisLabelColor	string	000000	series-axis color	hex color code. Ex: { serAxisLabelColor:'0088CC' }
serAxisLabelFontBold	boolean	false	make cat axis label bold	true or false
serAxisLabelFontFace	string	Arial	series-axis font face	font name. Ex: { titleFontFace:'Arial' }
serAxisLabelFontSize	integer	18	series-axis font size	1-256. Ex: { titleFontSize:12 }
serAxisLabelFrequency	integer		PPT "Interval Between Labels"	1-n. Ex: { serAxisLabelFrequency: 2 }
serAxisLabelPos	string	nextTo	axis label position	low, high, or nextTo . Ex: { serAxisLabelPos: 'low' }
serAxisLineShow	boolean	true	show/hide series-axis line	true or false
serAxisMajorTimeUnit	string		series-axis major time unit	days, months or years
serAxisMajorUnit	integer		series-axis major unit	Positive integer. Ex: { serAxisMajorUnit:12 }
serAxisMinorTimeUnit	string		series-axis minor time unit	days, months or years
serAxisMinorUnit	integer		series-axis minor unit	Positive integer. Ex: { serAxisMinorUnit:1 }
serAxisTitle	string	Axis Title	axis title	a string. Ex: { serAxisTitle:'Regions' }
serAxisTitleColor	string	000000	title color	hex color code. Ex: { serAxisTitleColor:'0088CC' }
serAxisTitleFontFace	string	Arial	font face	font name. Ex: { serAxisTitleFontFace:'Arial' }
serAxisTitleFontSize	integer		font size	1-256. Ex: { serAxisTitleFontSize:12 }
serAxisTitleRotate	integer		title rotation (degrees)	0-360. Ex: { serAxisTitleRotate:45 }
serGridLine	object	none	series grid line style	object with properties size (pt), color and style ('solid', 'dash' or 'dot') or 'none' to hide
v3DRAngAx	boolean	true	Right angle axes	true or false
v3DPerspective	integer	18	series-axis font size	1-240. Ex: { v3DPerspective:125 }
v3DRotX	integer		x-axis rotation (degrees)	-90 - 90. Ex: { v3DRotX:-45 }
v3DRotY	integer		title rotation (degrees)	0-360. Ex: { v3DRotY:180 }
valueBarColors	boolean	false	forces chartColors on multi-data-series	true or false
Element Shadows
Option	Type	Unit	Default	Description	Possible Values
type	string		outer	shadow type	outer or inner. Ex: { type:'outer' }
angle	number	degrees	90	shadow angle	0-359. Ex: { angle:90 }
blur	number	points	3	blur size	1-256. Ex: { blur:3 }
color	string		000000	shadow color	hex color code. Ex: { color:'0088CC' }
offset	number	points	1.8	offset size	1-256. Ex: { offset:2 }
opacity	number	percent	0.35	opacity	0-1. Ex: { opacity:0.35 }
Combo Chart Options
Option	Type	Default	Description	Possible Values
catAxes	array		array of two axis options objects	See example below
secondaryCatAxis	boolean	false	If data should use secondary category axis (or primary)	true or false
secondaryValAxis	boolean	false	If data should use secondary value axis (or primary)	true or false
valAxes	array		array of two axis options objects	See example below

# Images
Images of almost any type can be added to Slides.

Usage
// Image from remote URL
slide.addImage({ path: "https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg" });

// Image by local URL
slide.addImage({ path: "images/chart_world_peace_near.png" });

// Image by data (pre-encoded base64)
slide.addImage({ data: "image/png;base64,iVtDafDrBF[...]=" });

Usage Notes
Either provide a URL location or base64 data to create an image.

path - URL: relative or full
data - base64: string representing an encoded image
Supported Formats and Notes
Standard image types: png, jpg, gif, et al.
Animated gifs: only shown animated on Microsoft 365/Office365 and the newest desktop versions, older versions will animate them in presentation mode only
SVG images: supported in the newest version of desktop PowerPoint or Microsoft 365/Office365
Performance Considerations
It takes CPU time to read and encode images! The more images you include and the larger they are, the more time will be consumed.

The time needed to read/encode images can be completely eliminated by pre-encoding any images
Pre-encode images into a base64 strings and use the data option value instead
This will both reduce dependencies (who needs another image asset to keep track of?) and provide a performance boost (no time will need to be consumed reading and encoding the image)
Base Properties
Position/Size Props (PositionProps)
Option	Type	Default	Description	Possible Values
x	number	1.0	hor location (inches)	0-n
x	string		hor location (percent)	'n%'. (Ex: {x:'50%'} middle of the Slide)
y	number	1.0	ver location (inches)	0-n
y	string		ver location (percent)	'n%'. (Ex: {y:'50%'} middle of the Slide)
w	number	1.0	width (inches)	0-n
w	string		width (percent)	'n%'. (Ex: {w:'50%'} 50% the Slide width)
h	number	1.0	height (inches)	0-n
h	string		height (percent)	'n%'. (Ex: {h:'50%'} 50% the Slide height)
Data/Path Props (DataOrPathProps)
Option	Type	Default	Description	Possible Values
data	string		image data (base64)	base64-encoded image string. (either data or path is required)
path	string		image path	Same as used in an (img src="") tag. (either data or path is required)
Image Props (ImageProps)
Option	Type	Default	Description	Possible Values
altText	string		alt text value	description of what image shows
flipH	boolean	false	Flip horizontally?	true, false
flipV	boolean	false	Flip vertical?	true, false
hyperlink	HyperlinkProps		add hyperlink	object with url or slide
placeholder	string		image placeholder	Placeholder location: title, body
rotate	integer	0	rotation (degrees)	Rotation degress: 0-359
rounding	boolean	false	image rounding	Shapes an image into a circle
sizing	object		transforms image	See Image Sizing
transparency	number	0	changes opacity of an image	0-100 where 0 means image is completely visible
Sizing Properties
The sizing option provides cropping and scaling an image to a specified area. The property expects an object with the following structure:

Property	Type	Unit	Default	Description	Possible Values
type	string			sizing algorithm	'crop', 'contain' or 'cover'
w	number	inches	w of the image	area width	0-n
h	number	inches	h of the image	area height	0-n
x	number	inches	0	area horizontal position related to the image	0-n (effective for crop only)
y	number	inches	0	area vertical position related to the image	0-n (effective for crop only)
Sizing Types
contain works as CSS property background-size — shrinks the image (ratio preserved) to the area given by w and h so that the image is completely visible. If the area's ratio differs from the image ratio, an empty space will surround the image.
cover works as CSS property background-size — shrinks the image (ratio preserved) to the area given by w and h so that the area is completely filled. If the area's ratio differs from the image ratio, the image is centered to the area and cropped.
crop cuts off a part specified by image-related coordinates x, y and size w, h.
Sizing Notes
If you specify an area size larger than the image for the contain and cover type, then the image will be stretched, not shrunken.
In case of the crop option, if the specified area reaches out of the image, then the covered empty space will be a part of the image.
When the sizing property is used, its w and h values represent the effective image size. For example, in the following snippet, width and height of the image will both equal to 2 inches and its top-left corner will be located at [1 inch, 1 inch]:
Shadow Properties (ShadowProps)
The ShadowProps property adds a shadow to an image.

Examples
Image Types Examples
Image Types Examples

Data/Path Examples
Image Paths Examples

Rotate Examples
Image Rotate Examples

Shadow Examples
Image Shadow Examples

Sizing Examples
Image Sizing Examples

All Image Samples
All sample javascript code: demos/modules/demo_image.mjs


# Media
Media enables the addition of audio, video, and online video to Slides.

Usage
// Path: full or relative
slide.addMedia({ type: "video", path: "https://example.com/media/sample.mov" });
slide.addMedia({ type: "video", path: "../media/sample.mov" });

// Base64: pre-encoded string
slide.addMedia({ type: "audio", data: "audio/mp3;base64,iVtDafDrBF[...]=" });

// YouTube: Online video (supported in Microsoft 365)
slide.addMedia({ type: "online", link: "https://www.youtube.com/embed/Dph6ynRVyUc" });

Usage Notes
Either provide a URL location or base64 data along with type to create media.

type - type: media type
path - URL: relative or full
data - base64: string representing an encoded image
Supported Formats and Notes
Video (mpg, mov, mp4, m4v, et al.); Audio (mp3, wav, et al.); (see Video and Audio file formats supported in PowerPoint)
YouTube videos can be viewed using Microsoft 365/Office 365 (they may show errors on older desktop PowerPoint versions)
Other online video sites may be supported as well (some users have reported non-YouTube sites that worked)
Not all platforms support all formats! MacOS can show MPG files whereas Windows probably will not, and some AVI files may work and some may not. Video codecs are weird and painful like that.
Properties
Position/Size Props (PositionProps)
Option	Type	Default	Description	Possible Values
x	number	1.0	hor location (inches)	0-n
x	string		hor location (percent)	'n%'. (Ex: {x:'50%'} middle of the Slide)
y	number	1.0	ver location (inches)	0-n
y	string		ver location (percent)	'n%'. (Ex: {y:'50%'} middle of the Slide)
w	number	1.0	width (inches)	0-n
w	string		width (percent)	'n%'. (Ex: {w:'50%'} 50% the Slide width)
h	number	1.0	height (inches)	0-n
h	string		height (percent)	'n%'. (Ex: {h:'50%'} 50% the Slide height)
Data/Path Props (DataOrPathProps)
Option	Type	Description	Possible Values
data	string	image data (base64)	(data or path is required) base64-encoded image string.
path	string	image path	(data or path is required) relative or full URL
Media Props (MediaProps)
Option	Type	Description	Possible Values
type	string	media type	media type: audio or video (reqs: data or path) or online (reqs:link)
cover	string	cover image	base64 encoded string of cover image
extn	string	media extension	use when the media file path does not already have an extension, ex: "/folder/SomeSong"
link	string	video URL	(YouTube only): link to online video
Example
Media Examples

# Shapes
Almost 200 shape types can be added to Slides (see ShapeType enum).

Usage
// Shapes without text
slide.addShape(pres.ShapeType.rect, { fill: { color: "FF0000" } });
slide.addShape(pres.ShapeType.ellipse, {
  fill: { type: "solid", color: "0088CC" },
});
slide.addShape(pres.ShapeType.line, { line: { color: "FF0000", width: 1 } });

// Shapes with text
slide.addText("ShapeType.rect", {
  shape: pres.ShapeType.rect,
  fill: { color: "FF0000" },
});
slide.addText("ShapeType.ellipse", {
  shape: pres.ShapeType.ellipse,
  fill: { color: "FF0000" },
});
slide.addText("ShapeType.line", {
  shape: pres.ShapeType.line,
  line: { color: "FF0000", width: 1, dashType: "lgDash" },
});

Properties
Position/Size Props (PositionProps)
Name	Type	Default	Description	Possible Values
x	number	1.0	hor location (inches)	0-n
x	string		hor location (percent)	'n%'. (Ex: {x:'50%'} middle of the Slide)
y	number	1.0	ver location (inches)	0-n
y	string		ver location (percent)	'n%'. (Ex: {y:'50%'} middle of the Slide)
w	number	1.0	width (inches)	0-n
w	string		width (percent)	'n%'. (Ex: {w:'50%'} 50% the Slide width)
h	number	1.0	height (inches)	0-n
h	string		height (percent)	'n%'. (Ex: {h:'50%'} 50% the Slide height)
Shape Props (ShapeProps)
Name	Type	Description	Possible Values
align	string	alignment	left or center or right. Default: left
fill	ShapeFillProps	fill props	Fill color/transparency props
flipH	boolean	flip Horizontal	true or false
flipV	boolean	flip Vertical	true or false
hyperlink	HyperlinkProps	hyperlink props	(see type link)
line	ShapeLineProps	border line props	(see type link)
rectRadius	number	rounding radius	0 to 1. (Ex: 0.5. Only for pptx.shapes.ROUNDED_RECTANGLE)
rotate	number	rotation (degrees)	-360 to 360. Default: 0
shadow	ShadowProps	shadow props	(see type link)
shapeName	string	optional shape name	Ex: "Customer Network Diagram 99"
Examples
Shapes with Text Demo

# Tables
Tables and content can be added to Slides.

Usage
// TABLE 1: Single-row table
let rows = [["Cell 1", "Cell 2", "Cell 3"]];
slide.addTable(rows, { w: 9 });

// TABLE 2: Multi-row table
// - each row's array element is an array of cells
let rows = [["A1", "B1", "C1"]];
slide.addTable(rows, { align: "left", fontFace: "Arial" });

// TABLE 3: Formatting at a cell level
// - use this to selectively override the table's cell options
let rows = [
    [
        { text: "Top Lft", options: { align: "left", fontFace: "Arial" } },
        { text: "Top Ctr", options: { align: "center", fontFace: "Verdana" } },
        { text: "Top Rgt", options: { align: "right", fontFace: "Courier" } },
    ],
];
slide.addTable(rows, { w: 9, rowH: 1, align: "left", fontFace: "Arial" });

Usage Notes
Properties passed to addTable() apply to every cell in the table
Selectively override formatting at a cell-level by providing properties to the cell object
Cell Formatting
Table cells can be either a plain text string or an object with text and options properties
When using an object, any of the formatting options above can be passed in options and will apply to that cell only
Cell borders can be removed (aka: borderless table) by using the 'none' type (Ex: border: {type:'none'})
Bullets and word-level formatting are supported inside table cells. Passing an array of objects with text/options values as the text value allows fine-grained control over the text inside cells.
Available formatting options are here: Text Props
Row Height
Use the h property to have row(s) divided evenly across the defined area
Use the rowH property with an array of values to specify row heights (indexed 0-n)
Omit both properties to have table rows consume only the space required for its contents
Properties
Position/Size Props (PositionProps)
Option	Type	Default	Description	Possible Values
x	number	1.0	hor location (inches)	0-n
x	string		hor location (percent)	'n%'. (Ex: {x:'50%'} middle of the Slide)
y	number	1.0	ver location (inches)	0-n
y	string		ver location (percent)	'n%'. (Ex: {y:'50%'} middle of the Slide)
w	number	1.0	width (inches)	0-n
w	string		width (percent)	'n%'. (Ex: {w:'50%'} 50% the Slide width)
h	number	1.0	height (inches)	0-n
h	string		height (percent)	'n%'. (Ex: {h:'50%'} 50% the Slide height)
Table Layout Options (ITableOptions)
Option	Type	Description	Possible Values (inches or percent)
colW	integer	width for every column	Ex: Width for every column in table (uniform) 2.0
colW	array	column widths in order	Ex: Width for each of 5 columns [1.0, 2.0, 2.5, 1.5, 1.0]
rowH	integer	height for every row	Ex: Height for every row in table (uniform) 2.0
rowH	array	row heights in order	Ex: Height for each of 5 rows [1.0, 2.0, 2.5, 1.5, 1.0]
Table Formatting Props (ITableOptions)
Option	Type	Unit	Default	Description	Possible Values
align	string		left	alignment	left or center or right
bold	boolean		false	bold text	true or false
border	object			cell border	object with type, pt and color values. (see below)
border	array			cell border	array of objects with pt and color values in TRBL order.
color	string			text color	hex color code or scheme color constant. Ex: {color:'0088CC'}
colspan	integer			column span	2-n. Ex: {colspan:2} (Note: be sure to include a table w value)
fill	string			fill/bkgd color	hex color code or scheme color constant. Ex: {color:'0088CC'}
fontFace	string			font face	Ex: {fontFace:'Arial'}
fontSize	number	points		font size	1-256. Ex: {fontSize:12}
italic	boolean		false	italic text	true or false
margin	number	points		margin	0-99 (ProTip: use the same value from CSS padding)
margin	array	points		margin	array of integer values in TRBL order. Ex: margin:[5,10,5,10]
rowspan	integer			row span	2-n. Ex: {rowspan:2}
underline	boolean		false	underline text	true or false
valign	string			vertical alignment	top or middle or bottom (or t m b)
Table Border Options (IBorderOptions)
Option	Type	Default	Description	Possible Values
type	string	solid	border type	none or solid or dash
pt	string	1	border thickness	any positive number
color	string	black	cell border	hex color code or scheme color constant. Ex: {color:'0088CC'}
Table Auto-Paging
Auto-paging will create new slides as table rows overflow, doing the magical work for you.

Table Auto-Paging Options (ITableOptions)
Option	Default	Description	Possible Values
autoPage	false	auto-page table	true or false. Ex: {autoPage:true}
autoPageCharWeight	0	char weight value (adjusts letter spacing)	-1.0 to 1.0. Ex: {autoPageCharWeight:0.5}
autoPageLineWeight	0	line weight value (adjusts line height)	-1.0 to 1.0. Ex: {autoPageLineWeight:0.5}
autoPageRepeatHeader	false	repeat header row(s) on each auto-page slide	true or false. Ex: {autoPageRepeatHeader:true}
autoPageHeaderRows	1	number of table rows that comprise the headers	1-n. Ex: 2 repeats the first two rows on every slide
newSlideStartY		starting y value for tables on new Slides	0-n OR 'n%'. Ex:{newSlideStartY:0.5}
Auto-Paging Property Notes
autoPage: allows the auto-paging functionality (as table rows overflow the Slide, new Slides will be added) to be disabled.
autoPageCharWeight: adjusts the calculated width of characters. If too much empty space is left on each line, then increase char weight value. Conversely, if the table rows are overflowing, then reduce the char weight value.
autoPageLineWeight: adjusts the calculated height of lines. If too much empty space is left under each table, then increase line weight value. Conversely, if the tables are overflowing the bottom of the Slides, then reduce the line weight value. Also helpful when using some fonts that do not have the usual golden ratio.
newSlideStartY: provides the ability to specify where new tables will be placed on new Slides. For example, you may place a table halfway down a Slide, but you wouldn't that to be the starting location for subsequent tables. Use this option to ensure there is no wasted space and to guarantee a professional look.
Auto-Paging Usage Notes
New slides will be created as tables overflow. The table will start at either newSlideStartY (if present) or the Slide's top margin
Tables will retain their existing x, w, and colW values as they are rendered onto subsequent Slides
Auto-paging is not an exact science! Try using different values for autoPageCharWeight/autoPageLineWeight and slide margin
Very small and very large font sizes cause tables to over/under-flow, be sure to adjust the char and line properties
There are many examples of auto-paging in the examples folder
Examples
Table Cell Formatting
Sample Code: demo_table.mjs for 700+ lines of demo code
Online Demo: pptxgenjs Table Demos
// -------
// TABLE 1: Cell-level Formatting
// -------
let rows = [];

// Row One: cells will be formatted according to any options provided to `addTable()`
rows.push(["First", "Second", "Third"]);

// Row Two: set/override formatting for each cell
rows.push([
    { text: "1st", options: { color: "ff0000" } },
    { text: "2nd", options: { color: "00ff00" } },
    { text: "3rd", options: { color: "0000ff" } },
]);

slide.addTable(rows, { x: 0.5, y: 1.0, w: 9.0, color: "363636" });

// -------
// TABLE 2: Using word-level formatting inside cells
// -------
// NOTE: An array of text/options objects provides fine-grained control over formatting
let arrObjText = [
    { text: "Red ", options: { color: "FF0000" } },
    { text: "Green ", options: { color: "00FF00" } },
    { text: "Blue", options: { color: "0000FF" } },
];

// EX A: Pass an array of text objects to `addText()`
slide.addText(arrObjText, {
    x: 0.5,
    y: 2.0,
    w: 9,
    h: 1,
    margin: 0.1,
    fill: "232323",
});

// EX B: Pass the same objects as a cell's `text` value
let arrTabRows = [
    [
        { text: "Cell 1 A", options: { fontFace: "Arial" } },
        { text: "Cell 1 B", options: { fontFace: "Courier" } },
        { text: arrObjText, options: { fill: "232323" } },
    ],
];

slide.addTable(arrTabRows, { x: 0.5, y: 3.5, w: 9, h: 1, colW: [1.5, 1.5, 6] });

Table Cell Formatting

# Text
Text shapes can be added to Slides.

Usage
slide.addText([{ text: "TEXT", options: { OPTIONS } }]);

Properties
Position/Size Props (PositionProps)
Name	Type	Default	Description	Possible Values
x	number	1.0	hor location (inches)	0-n
x	string		hor location (percent)	'n%'. (Ex: {x:'50%'} middle of the Slide)
y	number	1.0	ver location (inches)	0-n
y	string		ver location (percent)	'n%'. (Ex: {y:'50%'} middle of the Slide)
w	number	1.0	width (inches)	0-n
w	string		width (percent)	'n%'. (Ex: {w:'50%'} 50% the Slide width)
h	number	1.0	height (inches)	0-n
h	string		height (percent)	'n%'. (Ex: {h:'50%'} 50% the Slide height)
Base Properties (TextPropsOptions)
Option	Type	Unit	Default	Description	Possible Values
align	string		left	alignment	left or center or right
autoFit	boolean		false	"Fit to Shape"	true or false
baseline	number	points		text baseline value	0-256
bold	boolean		false	bold text	true or false
breakLine	boolean		false	appends a line break	true or false (only applies when used in text options) Ex: {text:'hi', options:{breakLine:true}}
bullet	boolean		false	bulleted text	true or false
bullet	object			bullet options	object with type, code or style. Ex: bullet:{type:'number'}. Ex: bullet:{code:'2605'}. Ex: {style:'alphaLcPeriod'}
charSpacing	number	points		character spacing	1-256. Ex: { charSpacing:12 }
color	string			text color	hex color code or scheme color. Ex: { color:'0088CC' }
fill	string			fill/bkgd color	hex color code or scheme color. Ex: { color:'0088CC' }
fit	string		none	text fit options	none, shrink, resize. Ex: { fit:'shrink' }
fontFace	string			font face	Ex: { fontFace:'Arial'}
fontSize	number	points		font size	1-256. Ex: { fontSize:12 }
glow	object			text glow	object with size, opacity, color (opt). Ex: glow:{size:10, opacity:0.75, color:'0088CC'}
highlight	string			highlight color	hex color code or scheme color. Ex: { color:'0088CC' }
hyperlink	string			add hyperlink	object with url or slide (tooltip optional). Ex: { hyperlink:{url:'https://github.com'} }
indentLevel	number	level	0	bullet indent level	1-32. Ex: { indentLevel:1 }
inset	number	inches		inset/padding	1-256. Ex: { inset:1.25 }
isTextBox	boolean		false	PPT "Textbox"	true or false
italic	boolean		false	italic text	true or false
lang	string		en-US	language setting	Ex: { lang:'zh-TW' } (Set this when using non-English fonts like Chinese)
line	object			line/border	adds a border. Ex: line:{ width:'2', color:'A9A9A9' }
lineSpacing	number	points		line spacing points	1-256. Ex: { lineSpacing:28 }
lineSpacingMultiple	number	percent		line spacing multiple	0.0-9.99
margin	number	points		margin	0-99 (ProTip: use the same value from CSS padding)
outline	object			text outline options	Options: color & size. Ex: outline:{ size:1.5, color:'FF0000' }
paraSpaceAfter	number	points		paragraph spacing	Paragraph Spacing: After. Ex: { paraSpaceAfter:12 }
paraSpaceBefore	number	points		paragraph spacing	Paragraph Spacing: Before. Ex: { paraSpaceBefore:12 }
rectRadius	number	inches		rounding radius	rounding radius for ROUNDED_RECTANGLE text shapes
rotate	integer	degrees	0	text rotation degrees	0-360. Ex: {rotate:180}
rtlMode	boolean		false	enable Right-to-Left mode	true or false
shadow	object			text shadow options	see "Shadow Properties" below. Ex: shadow:{ type:'outer' }
softBreakBefore	boolean		false	soft (shift-enter) break	Add a soft line-break (shift+enter) before line text content
strike	string			text strikethrough	dblStrike or sngStrike
subscript	boolean		false	subscript text	true or false
superscript	boolean		false	superscript text	true or false
transparency	number		0	transparency	Percentage: 0-100
underline	TextUnderlineProps			underline color/style	TextUnderlineProps
valign	string			vertical alignment	top or middle or bottom
vert	string		horz	text direction	eaVert or horz or mongolianVert or vert or vert270 or wordArtVert or wordArtVertRtl
wrap	boolean		true	text wrapping	true or false
Shadow Properties (ShadowProps)
Option	Type	Unit	Default	Description	Possible Values
type	string		outer	shadow type	outer or inner
angle	number	degrees		shadow angle	0-359. Ex: { angle:180 }
blur	number	points		blur size	1-256. Ex: { blur:3 }
color	string			text color	hex color code or scheme color constant. Ex: { color:'0088CC' }
offset	number	points		offset size	1-256. Ex: { offset:8 }
opacity	number	percent		opacity	0-1. Ex: opacity:0.75
Examples
Text Options
var pptx = new PptxGenJS();
var slide = pptx.addSlide();

// EX: Dynamic location using percentages
slide.addText("^ (50%/50%)", { x: "50%", y: "50%" });

// EX: Basic formatting
slide.addText("Hello", { x: 0.5, y: 0.7, w: 3, color: "0000FF", fontSize: 64 });
slide.addText("World!", { x: 2.7, y: 1.0, w: 5, color: "DDDD00", fontSize: 90 });

// EX: More formatting options
slide.addText("Arial, 32pt, green, bold, underline, 0 inset", {
    x: 0.5,
    y: 5.0,
    w: "90%",
    margin: 0.5,
    fontFace: "Arial",
    fontSize: 32,
    color: "00CC00",
    bold: true,
    underline: true,
    isTextBox: true,
});

// EX: Format some text
slide.addText("Hello World!", { x: 2, y: 4, fontFace: "Arial", fontSize: 42, color: "00CC00", bold: true, italic: true, underline: true });

// EX: Multiline Text / Line Breaks - use "\n" to create line breaks inside text strings
slide.addText("Line 1\nLine 2\nLine 3", { x: 2, y: 3, color: "DDDD00", fontSize: 90 });

// EX: Format individual words or lines by passing an array of text objects with `text` and `options`
slide.addText(
    [
        { text: "word-level", options: { fontSize: 36, color: "99ABCC", align: "right", breakLine: true } },
        { text: "formatting", options: { fontSize: 48, color: "FFFF00", align: "center" } },
    ],
    { x: 0.5, y: 4.1, w: 8.5, h: 2.0, fill: { color: "F1F1F1" } }
);

// EX: Bullets
slide.addText("Regular, black circle bullet", { x: 8.0, y: 1.4, w: "30%", h: 0.5, bullet: true });
// Use line-break character to bullet multiple lines
slide.addText("Line 1\nLine 2\nLine 3", { x: 8.0, y: 2.4, w: "30%", h: 1, fill: { color: "F2F2F2" }, bullet: { type: "number" } });
// Bullets can also be applied on a per-line level
slide.addText(
    [
        { text: "I have a star bullet", options: { bullet: { code: "2605" }, color: "CC0000" } },
        { text: "I have a triangle bullet", options: { bullet: { code: "25BA" }, color: "00CD00" } },
        { text: "no bullets on this line", options: { fontSize: 12 } },
        { text: "I have a normal bullet", options: { bullet: true, color: "0000AB" } },
    ],
    { x: 8.0, y: 5.0, w: "30%", h: 1.4, color: "ABABAB", margin: 1 }
);

// EX: Paragraph Spacing
slide.addText("Paragraph spacing - before:12pt / after:24pt", {
    x: 1.5,
    y: 1.5,
    w: 6,
    h: 2,
    fill: { color: "F1F1F1" },
    paraSpaceBefore: 12,
    paraSpaceAfter: 24,
});

// EX: Hyperlink: Web
slide.addText(
    [
        {
            text: "PptxGenJS Project",
            options: { hyperlink: { url: "https://github.com/gitbrent/pptxgenjs", tooltip: "Visit Homepage" } },
        },
    ],
    { x: 1.0, y: 1.0, w: 5, h: 1 }
);
// EX: Hyperlink: Slide in Presentation
slide.addText(
    [
        {
            text: "Slide #2",
            options: { hyperlink: { slide: 2, tooltip: "Go to Summary Slide" } },
        },
    ],
    { x: 1.0, y: 2.5, w: 5, h: 1 }
);

// EX: Drop/Outer Shadow
slide.addText("Outer Shadow", {
    x: 0.5,
    y: 6.0,
    fontSize: 36,
    color: "0088CC",
    shadow: { type: "outer", color: "696969", blur: 3, offset: 10, angle: 45 },
});

// EX: Text Outline
slide.addText("Text Outline", {
    x: 0.5,
    y: 6.0,
    fontSize: 36,
    color: "0088CC",
    outline: { size: 1.5, color: "696969" },
});

// EX: Formatting can be applied at the word/line level
// Provide an array of text objects with the formatting options for that `text` string value
// Line-breaks work as well
slide.addText(
    [
        { text: "word-level\nformatting", options: { fontSize: 36, fontFace: "Courier New", color: "99ABCC", align: "right", breakLine: true } },
        { text: "...in the same textbox", options: { fontSize: 48, fontFace: "Arial", color: "FFFF00", align: "center" } },
    ],
    { x: 0.5, y: 4.1, w: 8.5, h: 2.0, margin: 0.1, fill: { color: "232323" } }
);

pptx.writeFile("Demo-Text");


Line Break Options
Use the breakLine prop to force line breaks when composing text objects using an array of text objects.
Use the softBreakBefore prop to create a "soft line break" (shift-enter)
let arrTextObjs1 = [
    { text: "1st line", options: { fontSize: 24, color: "99ABCC", breakLine: true } },
    { text: "2nd line", options: { fontSize: 36, color: "FFFF00", breakLine: true } },
    { text: "3rd line", options: { fontSize: 48, color: "0088CC" } },
];
slide.addText(arrTextObjs1, { x: 0.5, y: 1, w: 8, h: 2, fill: { color: "232323" } });

let arrTextObjs2 = [
    { text: "1st line", options: { fontSize: 24, color: "99ABCC", breakLine: false } },
    { text: "2nd line", options: { fontSize: 36, color: "FFFF00", breakLine: false } },
    { text: "3rd line", options: { fontSize: 48, color: "0088CC" } },
];
slide.addText(arrTextObjs2, { x: 0.5, y: 4, w: 8, h: 2, fill: { color: "232323" } });

Line Break Examples
text line breaks

Text Formatting
text formatting

Bullet Options
bullets options

Tab Stops
tab stops






















