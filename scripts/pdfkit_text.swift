import Foundation
import PDFKit

let args = CommandLine.arguments

guard args.count >= 2 else {
  fputs("Usage: pdfkit_text.swift <pdf-path>\n", stderr)
  exit(1)
}

let url = URL(fileURLWithPath: args[1])

guard let doc = PDFDocument(url: url) else {
  fputs("Could not open PDF\n", stderr)
  exit(1)
}

for index in 0 ..< doc.pageCount {
  let text = doc.page(at: index)?.string ?? ""
  print("--- PAGE \(index + 1) ---")
  print(text)
}
