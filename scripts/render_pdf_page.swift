import AppKit
import CoreGraphics
import Foundation
import PDFKit

func renderPage(_ page: PDFPage) -> CGImage? {
  let pageRect = page.bounds(for: .mediaBox)
  let scale: CGFloat = 4.0
  let width = Int(pageRect.width * scale)
  let height = Int(pageRect.height * scale)

  guard
    let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
    let context = CGContext(
      data: nil,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: 0,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )
  else {
    return nil
  }

  context.setFillColor(NSColor.white.cgColor)
  context.fill(CGRect(x: 0, y: 0, width: width, height: height))
  context.saveGState()
  context.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: context)
  context.restoreGState()

  return context.makeImage()
}

let args = CommandLine.arguments

guard args.count >= 4 else {
  fputs("Usage: render_pdf_page.swift <pdf-path> <page-number> <output-png>\n", stderr)
  exit(1)
}

let pdfURL = URL(fileURLWithPath: args[1])
let pageNumber = max(1, Int(args[2]) ?? 1)
let outputURL = URL(fileURLWithPath: args[3])

guard let document = PDFDocument(url: pdfURL) else {
  fputs("Could not open PDF\n", stderr)
  exit(1)
}

guard let page = document.page(at: pageNumber - 1), let image = renderPage(page) else {
  fputs("Could not render page\n", stderr)
  exit(1)
}

let bitmap = NSBitmapImageRep(cgImage: image)
guard let data = bitmap.representation(using: .png, properties: [:]) else {
  fputs("Could not encode PNG\n", stderr)
  exit(1)
}

do {
  try data.write(to: outputURL)
} catch {
  fputs("Could not write PNG: \(error)\n", stderr)
  exit(1)
}
