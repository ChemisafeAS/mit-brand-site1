import AppKit
import CoreGraphics
import ImageIO
import Foundation
import PDFKit
import Vision

struct PageResult: Codable {
  let pageNumber: Int
  let text: String
}

struct ExtractionResult: Codable {
  let pages: [PageResult]
}

func renderPage(_ page: PDFPage) -> CGImage? {
  let pageRect = page.bounds(for: .mediaBox)
  let scale: CGFloat = 2.0
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
  context.translateBy(x: 0, y: CGFloat(height))
  context.scaleBy(x: scale, y: -scale)
  page.draw(with: .mediaBox, to: context)
  context.restoreGState()

  return context.makeImage()
}

func recognizeText(from image: CGImage, orientation: CGImagePropertyOrientation) throws -> String {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  request.minimumTextHeight = 0.002

  let handler = VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:])
  try handler.perform([request])

  let observations = request.results ?? []
  let sorted = observations.sorted {
    let leftA = $0.boundingBox.minX
    let leftB = $1.boundingBox.minX
    let topA = $0.boundingBox.maxY
    let topB = $1.boundingBox.maxY

    if abs(topA - topB) > 0.02 {
      return topA > topB
    }

    return leftA < leftB
  }

  return sorted.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
}

func recognizeBestText(from image: CGImage) -> String {
  let orientations: [CGImagePropertyOrientation] = [.up, .right, .left, .down]
  var bestText = ""

  for orientation in orientations {
    let candidate = (try? recognizeText(from: image, orientation: orientation)) ?? ""

    if candidate.count > bestText.count {
      bestText = candidate
    }
  }

  return bestText
}

let arguments = CommandLine.arguments

guard arguments.count >= 2 else {
  fputs("Usage: extract_pdf_text.swift <pdf-path>\n", stderr)
  exit(1)
}

let pdfURL = URL(fileURLWithPath: arguments[1])

guard let document = PDFDocument(url: pdfURL) else {
  fputs("Could not open PDF at \(pdfURL.path)\n", stderr)
  exit(1)
}

var pages: [PageResult] = []

for index in 0 ..< document.pageCount {
  guard let page = document.page(at: index), let image = renderPage(page) else {
    continue
  }

  let text = recognizeBestText(from: image)
  pages.append(PageResult(pageNumber: index + 1, text: text))
}

let result = ExtractionResult(pages: pages)
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

do {
  let data = try encoder.encode(result)
  FileHandle.standardOutput.write(data)
} catch {
  fputs("Failed to encode OCR result: \(error)\n", stderr)
  exit(1)
}
