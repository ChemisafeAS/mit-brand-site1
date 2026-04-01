import Foundation
import ImageIO
import Vision

let args = CommandLine.arguments

guard args.count >= 2 else {
  fputs("Usage: ocr_image.swift <image-path>\n", stderr)
  exit(1)
}

let imageURL = URL(fileURLWithPath: args[1])
guard
  let source = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
  let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
else {
  fputs("Could not load image\n", stderr)
  exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.minimumTextHeight = 0.002

let handler = VNImageRequestHandler(cgImage: image, options: [:])

do {
  try handler.perform([request])
  let observations = request.results ?? []
  let sorted = observations.sorted {
    let topA = $0.boundingBox.maxY
    let topB = $1.boundingBox.maxY
    if abs(topA - topB) > 0.02 {
      return topA > topB
    }
    return $0.boundingBox.minX < $1.boundingBox.minX
  }
  let lines = sorted.compactMap { $0.topCandidates(1).first?.string }
  print(lines.joined(separator: "\n"))
} catch {
  fputs("OCR failed: \(error)\n", stderr)
  exit(1)
}
