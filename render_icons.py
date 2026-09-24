"""Regenerate PNG app icons from the published vector logo."""
from io import BytesIO

import fitz
from reportlab.pdfgen import canvas


buffer = BytesIO()
c = canvas.Canvas(buffer, pagesize=(1024, 1024))
c.translate(0, 1024)
c.scale(1, -1)
c.setFillColorRGB(23 / 255, 61 / 255, 43 / 255)
c.roundRect(0, 0, 1024, 1024, 220, fill=1, stroke=0)
c.setStrokeColorRGB(247 / 255, 246 / 255, 237 / 255)
c.setLineCap(1)
c.setLineJoin(1)
c.setLineWidth(74)
p = c.beginPath()
p.moveTo(210, 718)
p.lineTo(486, 318)
p.curveTo(500, 297, 531, 297, 546, 318)
p.lineTo(824, 718)
c.drawPath(p, stroke=1)
c.setLineWidth(58)
c.line(514, 355, 514, 718)
c.setStrokeColorRGB(184 / 255, 237 / 255, 92 / 255)
c.setLineWidth(48)
p = c.beginPath()
p.moveTo(260, 778)
p.curveTo(378, 707, 474, 694, 561, 731)
p.curveTo(635, 763, 690, 752, 764, 689)
c.drawPath(p, stroke=1)
c.setFillColorRGB(184 / 255, 237 / 255, 92 / 255)
c.circle(257, 780, 42, fill=1, stroke=0)
c.showPage()
c.save()

document = fitz.open(stream=buffer.getvalue(), filetype="pdf")
for size, filename in ((32, "favicon-32x32.png"), (180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")):
    document[0].get_pixmap(matrix=fitz.Matrix(size / 1024, size / 1024), alpha=True).save(filename)
