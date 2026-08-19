package com.narrativex.backend.feature.storyboard.infrastructure.document;

import com.narrativex.backend.feature.storyboard.application.port.out.ChapterDocumentTextExtractor;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

@Component
public class ChapterDocumentTextExtractorAdapter implements ChapterDocumentTextExtractor {
  @Override
  public String extract(String fileName, String contentType, byte[] content) {
    if (content == null || content.length == 0) {
      throw new IllegalArgumentException("Import file must not be empty");
    }
    String extension = extension(fileName);
    try {
      return switch (extension) {
        case "txt" -> new String(content, StandardCharsets.UTF_8);
        case "docx" -> extractDocx(content);
        case "pdf" -> extractPdf(content);
        default ->
            throw new IllegalArgumentException("Only .txt, .docx and .pdf files are supported");
      };
    } catch (IllegalArgumentException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new IllegalArgumentException("Unable to read import document", exception);
    }
  }

  private static String extractPdf(byte[] content) throws Exception {
    try (var document = Loader.loadPDF(content)) {
      return new PDFTextStripper().getText(document);
    }
  }

  private static String extractDocx(byte[] content) throws Exception {
    byte[] documentXml = null;
    try (var zip = new ZipInputStream(new ByteArrayInputStream(content))) {
      ZipEntry entry;
      while ((entry = zip.getNextEntry()) != null) {
        if ("word/document.xml".equals(entry.getName())) {
          documentXml = zip.readAllBytes();
          break;
        }
      }
    }
    if (documentXml == null)
      throw new IllegalArgumentException("DOCX document.xml was not found");

    DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
    factory.setNamespaceAware(true);
    factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
    factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
    factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
    factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
    factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");

    var document = factory.newDocumentBuilder().parse(new ByteArrayInputStream(documentXml));
    StringBuilder text = new StringBuilder();
    NodeList paragraphs = document.getElementsByTagNameNS("*", "p");
    for (int i = 0; i < paragraphs.getLength(); i++) {
      Node paragraph = paragraphs.item(i);
      appendTextNodes(paragraph, text);
      text.append('\n');
    }
    return text.toString();
  }

  private static void appendTextNodes(Node node, StringBuilder target) {
    if (node.getNodeType() == Node.ELEMENT_NODE && "t".equals(node.getLocalName())) {
      target.append(node.getTextContent());
      return;
    }
    NodeList children = node.getChildNodes();
    for (int i = 0; i < children.getLength(); i++) appendTextNodes(children.item(i), target);
  }

  private static String extension(String fileName) {
    String normalized = fileName == null ? "" : fileName.trim().toLowerCase(Locale.ROOT);
    int dot = normalized.lastIndexOf('.');
    return dot < 0 ? "" : normalized.substring(dot + 1);
  }
}
