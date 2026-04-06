import AppKit
import CoreGraphics
import Foundation

let args = CommandLine.arguments

guard args.count >= 7 else {
  fputs(
    "Usage: crop_image_region.swift <image-path> <x-factor> <y-factor> <width-factor> <height-factor> <output-png>\n",
    stderr
  )
  exit(1)
}

let imageURL = URL(fileURLWithPath: args[1])
let xFactor = max(0, min(1, Double(args[2]) ?? 0))
let yFactor = max(0, min(1, Double(args[3]) ?? 0))
let widthFactor = max(0, min(1, Double(args[4]) ?? 1))
let heightFactor = max(0, min(1, Double(args[5]) ?? 1))
let outputURL = URL(fileURLWithPath: args[6])

guard let image = NSImage(contentsOf: imageURL) else {
  fputs("Could not open image\n", stderr)
  exit(1)
}

var proposedRect = CGRect(origin: .zero, size: image.size)
guard
  let cgImage = image.cgImage(forProposedRect: &proposedRect, context: nil, hints: nil)
else {
  fputs("Could not decode image\n", stderr)
  exit(1)
}

let imageWidth = cgImage.width
let imageHeight = cgImage.height

let x = min(imageWidth - 1, max(0, Int(Double(imageWidth) * xFactor)))
let y = min(imageHeight - 1, max(0, Int(Double(imageHeight) * yFactor)))
let width = max(1, min(imageWidth - x, Int(Double(imageWidth) * widthFactor)))
let height = max(1, min(imageHeight - y, Int(Double(imageHeight) * heightFactor)))

let cropRect = CGRect(x: x, y: y, width: width, height: height)

guard let croppedImage = cgImage.cropping(to: cropRect) else {
  fputs("Could not crop image\n", stderr)
  exit(1)
}

let bitmap = NSBitmapImageRep(cgImage: croppedImage)
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
