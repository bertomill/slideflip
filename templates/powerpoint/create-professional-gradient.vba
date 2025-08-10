Sub CreateProfessionalGradientSlide()
    '
    ' CreateProfessionalGradientSlide Macro
    ' Creates a professional gradient slide template
    '
    
    Dim pptSlide As Slide
    Dim pptShape As Shape
    Dim pptTextBox As Shape
    
    ' Create new slide with blank layout
    Set pptSlide = ActivePresentation.Slides.Add(ActivePresentation.Slides.Count + 1, ppLayoutBlank)
    
    ' Set slide background to gradient
    With pptSlide.Background.Fill
        .ForeColor.RGB = RGB(102, 126, 234) ' #667eea
        .BackColor.RGB = RGB(118, 75, 162)  ' #764ba2
        .GradientAngle = 135
        .Visible = msoTrue
        .Type = msoFillGradient
        .GradientColorType = msoGradientTwoColors
        .GradientStyle = msoGradientDiagonalUp
    End With
    
    ' Add title text box
    Set pptTextBox = pptSlide.Shapes.AddTextbox(msoTextOrientationHorizontal, 72, 72, 576, 100)
    With pptTextBox
        .TextFrame.TextRange.Text = "Your Main Title Here"
        .TextFrame.TextRange.Font.Name = "Segoe UI"
        .TextFrame.TextRange.Font.Size = 48
        .TextFrame.TextRange.Font.Bold = msoTrue
        .TextFrame.TextRange.Font.Color.RGB = RGB(255, 255, 255)
        .TextFrame.TextRange.ParagraphFormat.Alignment = ppAlignCenter
        .TextFrame.MarginLeft = 0
        .TextFrame.MarginRight = 0
        .TextFrame.MarginTop = 0
        .TextFrame.MarginBottom = 0
        .Fill.Visible = msoFalse
        .Line.Visible = msoFalse
        
        ' Add text shadow
        With .TextFrame.TextRange.Font.Shadow
            .Visible = msoTrue
            .OffsetX = 2
            .OffsetY = 2
            .Blur = 4
            .Transparency = 0.3
        End With
    End With
    
    ' Add subtitle text box
    Set pptTextBox = pptSlide.Shapes.AddTextbox(msoTextOrientationHorizontal, 72, 200, 576, 60)
    With pptTextBox
        .TextFrame.TextRange.Text = "Subtitle or Key Message"
        .TextFrame.TextRange.Font.Name = "Segoe UI"
        .TextFrame.TextRange.Font.Size = 25
        .TextFrame.TextRange.Font.Bold = msoFalse
        .TextFrame.TextRange.Font.Color.RGB = RGB(240, 240, 240)
        .TextFrame.TextRange.ParagraphFormat.Alignment = ppAlignCenter
        .TextFrame.MarginLeft = 0
        .TextFrame.MarginRight = 0
        .Fill.Visible = msoFalse
        .Line.Visible = msoFalse
    End With
    
    ' Add statistics box
    Set pptShape = pptSlide.Shapes.AddShape(msoShapeRoundedRectangle, 250, 300, 220, 80)
    With pptShape
        .Fill.ForeColor.RGB = RGB(255, 255, 255)
        .Fill.Transparency = 0.8 ' 20% opacity
        .Line.ForeColor.RGB = RGB(255, 255, 255)
        .Line.Transparency = 0.7 ' 30% opacity
        .Line.Weight = 1
        .Adjustments(1) = 0.25 ' Rounded corners
        
        ' Add text to statistics box
        .TextFrame.TextRange.Text = "85%" & vbCrLf & "Key Statistic or Metric"
        .TextFrame.TextRange.Font.Name = "Segoe UI"
        .TextFrame.TextRange.Paragraphs(1).Font.Size = 36
        .TextFrame.TextRange.Paragraphs(1).Font.Bold = msoTrue
        .TextFrame.TextRange.Paragraphs(1).Font.Color.RGB = RGB(255, 255, 255)
        .TextFrame.TextRange.Paragraphs(2).Font.Size = 14
        .TextFrame.TextRange.Paragraphs(2).Font.Bold = msoFalse
        .TextFrame.TextRange.Paragraphs(2).Font.Color.RGB = RGB(240, 240, 240)
        .TextFrame.TextRange.ParagraphFormat.Alignment = ppAlignCenter
        .TextFrame.MarginLeft = 15
        .TextFrame.MarginRight = 15
        .TextFrame.MarginTop = 15
        .TextFrame.MarginBottom = 15
    End With
    
    ' Add first content card
    Set pptShape = pptSlide.Shapes.AddShape(msoShapeRoundedRectangle, 100, 420, 200, 120)
    With pptShape
        .Fill.ForeColor.RGB = RGB(255, 255, 255)
        .Fill.Transparency = 0.85 ' 15% opacity
        .Line.ForeColor.RGB = RGB(255, 255, 255)
        .Line.Transparency = 0.8 ' 20% opacity
        .Line.Weight = 1
        .Adjustments(1) = 0.3 ' More rounded corners
        
        .TextFrame.TextRange.Text = "Key Point 1" & vbCrLf & "Supporting information and details that explain this important point."
        .TextFrame.TextRange.Font.Name = "Segoe UI"
        .TextFrame.TextRange.Paragraphs(1).Font.Size = 18
        .TextFrame.TextRange.Paragraphs(1).Font.Bold = msoTrue
        .TextFrame.TextRange.Paragraphs(1).Font.Color.RGB = RGB(255, 255, 255)
        .TextFrame.TextRange.Paragraphs(2).Font.Size = 12
        .TextFrame.TextRange.Paragraphs(2).Font.Bold = msoFalse
        .TextFrame.TextRange.Paragraphs(2).Font.Color.RGB = RGB(240, 240, 240)
        .TextFrame.MarginLeft = 25
        .TextFrame.MarginRight = 25
        .TextFrame.MarginTop = 25
        .TextFrame.MarginBottom = 25
    End With
    
    ' Add second content card
    Set pptShape = pptSlide.Shapes.AddShape(msoShapeRoundedRectangle, 420, 420, 200, 120)
    With pptShape
        .Fill.ForeColor.RGB = RGB(255, 255, 255)
        .Fill.Transparency = 0.85 ' 15% opacity
        .Line.ForeColor.RGB = RGB(255, 255, 255)
        .Line.Transparency = 0.8 ' 20% opacity
        .Line.Weight = 1
        .Adjustments(1) = 0.3 ' More rounded corners
        
        .TextFrame.TextRange.Text = "Key Point 2" & vbCrLf & "Additional context and data that reinforces your message."
        .TextFrame.TextRange.Font.Name = "Segoe UI"
        .TextFrame.TextRange.Paragraphs(1).Font.Size = 18
        .TextFrame.TextRange.Paragraphs(1).Font.Bold = msoTrue
        .TextFrame.TextRange.Paragraphs(1).Font.Color.RGB = RGB(255, 255, 255)
        .TextFrame.TextRange.Paragraphs(2).Font.Size = 12
        .TextFrame.TextRange.Paragraphs(2).Font.Bold = msoFalse
        .TextFrame.TextRange.Paragraphs(2).Font.Color.RGB = RGB(240, 240, 240)
        .TextFrame.MarginLeft = 25
        .TextFrame.MarginRight = 25
        .TextFrame.MarginTop = 25
        .TextFrame.MarginBottom = 25
    End With
    
    ' Add bullet points text box
    Set pptTextBox = pptSlide.Shapes.AddTextbox(msoTextOrientationHorizontal, 150, 580, 420, 100)
    With pptTextBox
        .TextFrame.TextRange.Text = "▶ Important bullet point with clear information" & vbCrLf & _
                                   "▶ Second key takeaway for your audience" & vbCrLf & _
                                   "▶ Final compelling point to remember"
        .TextFrame.TextRange.Font.Name = "Segoe UI"
        .TextFrame.TextRange.Font.Size = 13
        .TextFrame.TextRange.Font.Color.RGB = RGB(240, 240, 240)
        .TextFrame.TextRange.ParagraphFormat.SpaceAfter = 8
        .TextFrame.MarginLeft = 0
        .TextFrame.MarginRight = 0
        .Fill.Visible = msoFalse
        .Line.Visible = msoFalse
    End With
    
    MsgBox "Professional Gradient slide template created successfully!"
    
End Sub