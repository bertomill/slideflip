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





