/* Writes a real .xlsx — photos embedded, not linked — with no library.
 *
 * An .xlsx is a zip of XML parts. Writing it by hand rather than pulling in a
 * spreadsheet library buys two things that matter here: the app keeps working
 * offline forever with nothing to fetch, and the picture anchor is set in EMU
 * directly, so every photo lands at exactly the size the existing report uses.
 *
 * Column layout is fixed by that report and must not drift:
 *
 *   A Zone   B Segment  C Category  D KP     E Condition  F Note   G Timestamp
 *   H Latitude  I Longitude  J Street  K Sub-District  L District
 *   M Regency   N Photo
 */

(function (ARROW) {

  /* ── Picture geometry ───────────────────────────────────────────────── */

  var EMU_PER_CM = 360000;
  var PHOTO_WIDTH_CM = 5.56;
  var PHOTO_HEIGHT_CM = 2.81;

  var PHOTO_WIDTH_EMU = Math.round(PHOTO_WIDTH_CM * EMU_PER_CM);   // 2001600
  var PHOTO_HEIGHT_EMU = Math.round(PHOTO_HEIGHT_CM * EMU_PER_CM); // 1011600

  /* A hair of inset so the picture doesn't sit on the cell's gridline. */
  var INSET_EMU = 19050;                                            // 2 px

  /* Row tall enough to hold the picture plus both insets, in points. */
  var ROW_HEIGHT_PT = Math.ceil((PHOTO_HEIGHT_CM / 2.54) * 72 + 4); // 84

  var HEADERS = [
    'Zone', 'Segment', 'Category', 'KP', 'Condition', 'Note', 'Timestamp',
    'Latitude', 'Longitude', 'Street', 'Sub-District', 'District', 'Regency',
    'Photo'
  ];

  /* Character widths, and the style index each column's data cells use.
     Column N is sized so 5.56 cm of picture fits inside it. */
  var COLUMN_WIDTHS = [12, 11, 18, 11, 11, 18, 20, 12, 12, 16, 14, 16, 18, 30.5];
  var STYLE_TEXT = 2, STYLE_NUMBER = 3, STYLE_CENTER = 4;
  var COLUMN_STYLES = [
    STYLE_TEXT, STYLE_TEXT, STYLE_TEXT, STYLE_CENTER, STYLE_CENTER, STYLE_TEXT,
    STYLE_CENTER, STYLE_NUMBER, STYLE_NUMBER, STYLE_TEXT, STYLE_TEXT,
    STYLE_TEXT, STYLE_TEXT, STYLE_TEXT
  ];

  /* ── Text helpers ───────────────────────────────────────────────────── */

  function columnLetter(index) {
    var letter = '';
    index += 1;
    while (index > 0) {
      var remainder = (index - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      index = Math.floor((index - 1) / 26);
    }
    return letter;
  }

  /* Excel rejects a file containing control characters, and a note typed on a
     phone can pick one up. Strip them rather than produce a file that opens
     with a repair dialog. */
  function xmlEscape(value) {
    return String(value == null ? '' : value)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function utf8(text) { return new TextEncoder().encode(text); }

  function bytesOf(blob) {
    if (blob.arrayBuffer) {
      return blob.arrayBuffer().then(function (buffer) { return new Uint8Array(buffer); });
    }
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(new Uint8Array(reader.result)); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsArrayBuffer(blob);
    });
  }

  /* ── ZIP (stored, no compression) ───────────────────────────────────── */

  /* Photos are already JPEG and the XML is small next to them, so deflate
     would cost CPU on a phone for a percent or two. Stored entries are
     ordinary zip entries and Excel reads them without complaint. */

  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  }());

  function crc32(bytes) {
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function dosDateTime(date) {
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
      date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
  }

  /** entries: [{ name: string, data: Uint8Array }] -> Blob */
  function zip(entries, now) {
    var stamp = dosDateTime(now || new Date());
    var prepared = entries.map(function (entry) {
      var nameBytes = utf8(entry.name);
      return { nameBytes: nameBytes, data: entry.data, crc: crc32(entry.data) };
    });

    var total = 0;
    prepared.forEach(function (entry) {
      total += 30 + entry.nameBytes.length + entry.data.length;  // local header
      total += 46 + entry.nameBytes.length;                       // central
    });
    total += 22;                                                  // end record

    var buffer = new ArrayBuffer(total);
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    var offset = 0;

    prepared.forEach(function (entry) {
      entry.offset = offset;
      view.setUint32(offset, 0x04034B50, true);        offset += 4;
      view.setUint16(offset, 20, true);                offset += 2;  // version needed
      view.setUint16(offset, 0x0800, true);            offset += 2;  // UTF-8 names
      view.setUint16(offset, 0, true);                 offset += 2;  // stored
      view.setUint16(offset, stamp.time, true);        offset += 2;
      view.setUint16(offset, stamp.date, true);        offset += 2;
      view.setUint32(offset, entry.crc, true);         offset += 4;
      view.setUint32(offset, entry.data.length, true); offset += 4;
      view.setUint32(offset, entry.data.length, true); offset += 4;
      view.setUint16(offset, entry.nameBytes.length, true); offset += 2;
      view.setUint16(offset, 0, true);                 offset += 2;  // no extra
      bytes.set(entry.nameBytes, offset);              offset += entry.nameBytes.length;
      bytes.set(entry.data, offset);                   offset += entry.data.length;
    });

    var centralStart = offset;
    prepared.forEach(function (entry) {
      view.setUint32(offset, 0x02014B50, true);        offset += 4;
      view.setUint16(offset, 20, true);                offset += 2;  // version made by
      view.setUint16(offset, 20, true);                offset += 2;  // version needed
      view.setUint16(offset, 0x0800, true);            offset += 2;
      view.setUint16(offset, 0, true);                 offset += 2;
      view.setUint16(offset, stamp.time, true);        offset += 2;
      view.setUint16(offset, stamp.date, true);        offset += 2;
      view.setUint32(offset, entry.crc, true);         offset += 4;
      view.setUint32(offset, entry.data.length, true); offset += 4;
      view.setUint32(offset, entry.data.length, true); offset += 4;
      view.setUint16(offset, entry.nameBytes.length, true); offset += 2;
      view.setUint16(offset, 0, true);                 offset += 2;  // extra
      view.setUint16(offset, 0, true);                 offset += 2;  // comment
      view.setUint16(offset, 0, true);                 offset += 2;  // disk
      view.setUint16(offset, 0, true);                 offset += 2;  // internal attrs
      view.setUint32(offset, 0, true);                 offset += 4;  // external attrs
      view.setUint32(offset, entry.offset, true);      offset += 4;
      bytes.set(entry.nameBytes, offset);              offset += entry.nameBytes.length;
    });

    var centralSize = offset - centralStart;

    view.setUint32(offset, 0x06054B50, true);        offset += 4;  // end of central dir
    view.setUint16(offset, 0, true);                 offset += 2;  // this disk
    view.setUint16(offset, 0, true);                 offset += 2;  // disk with central dir
    view.setUint16(offset, prepared.length, true);   offset += 2;  // entries on this disk
    view.setUint16(offset, prepared.length, true);   offset += 2;  // entries total
    view.setUint32(offset, centralSize, true);       offset += 4;
    view.setUint32(offset, centralStart, true);      offset += 4;
    view.setUint16(offset, 0, true);                 offset += 2;  // no comment

    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  /* ── Workbook parts ─────────────────────────────────────────────────── */

  var XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

  function contentTypes() {
    return XML_DECL +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' +
      '</Types>';
  }

  function rootRels() {
    return XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';
  }

  function workbook() {
    return XML_DECL +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="Assets" sheetId="1" r:id="rId1"/></sheets>' +
      '</workbook>';
  }

  function workbookRels() {
    return XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';
  }

  function styles() {
    return XML_DECL +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      // Seven decimals: the coordinates are stored to that precision and Excel
      // would otherwise round the display to two and hide real differences.
      '<numFmts count="1"><numFmt numFmtId="164" formatCode="0.0000000"/></numFmts>' +
      '<fonts count="2">' +
        '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>' +
        '<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>' +
      '</fonts>' +
      '<fills count="3">' +
        '<fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="2">' +
        '<border><left/><right/><top/><bottom/><diagonal/></border>' +
        '<border>' +
          '<left style="thin"><color rgb="FFBFBFBF"/></left>' +
          '<right style="thin"><color rgb="FFBFBFBF"/></right>' +
          '<top style="thin"><color rgb="FFBFBFBF"/></top>' +
          '<bottom style="thin"><color rgb="FFBFBFBF"/></bottom>' +
          '<diagonal/></border>' +
      '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="5">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
          '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">' +
          '<alignment vertical="center" wrapText="1"/></xf>' +
        '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1">' +
          '<alignment vertical="center"/></xf>' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">' +
          '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  }

  function inlineCell(reference, styleIndex, text) {
    if (text === '' || text == null) {
      return '<c r="' + reference + '" s="' + styleIndex + '"/>';
    }
    return '<c r="' + reference + '" s="' + styleIndex + '" t="inlineStr">' +
      '<is><t xml:space="preserve">' + xmlEscape(text) + '</t></is></c>';
  }

  function numberCell(reference, styleIndex, value) {
    if (value == null || isNaN(value)) {
      return '<c r="' + reference + '" s="' + styleIndex + '"/>';
    }
    return '<c r="' + reference + '" s="' + styleIndex + '"><v>' +
      Number(value).toFixed(7) + '</v></c>';
  }

  /** rows: array of 14 values; index 7 and 8 are numbers, the rest text. */
  function sheet(rows) {
    var xml = XML_DECL +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<dimension ref="A1:N' + (rows.length + 1) + '"/>' +
      // The header stays put while scrolling forty rows of photographs.
      '<sheetViews><sheetView workbookViewId="0">' +
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      '</sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>';

    xml += '<cols>';
    COLUMN_WIDTHS.forEach(function (width, index) {
      xml += '<col min="' + (index + 1) + '" max="' + (index + 1) +
             '" width="' + width + '" customWidth="1"/>';
    });
    xml += '</cols><sheetData>';

    xml += '<row r="1" ht="22" customHeight="1">';
    HEADERS.forEach(function (header, index) {
      xml += inlineCell(columnLetter(index) + '1', 1, header);
    });
    xml += '</row>';

    rows.forEach(function (values, rowIndex) {
      var rowNumber = rowIndex + 2;
      xml += '<row r="' + rowNumber + '" ht="' + ROW_HEIGHT_PT + '" customHeight="1">';
      values.forEach(function (value, columnIndex) {
        var reference = columnLetter(columnIndex) + rowNumber;
        var style = COLUMN_STYLES[columnIndex];
        xml += (style === STYLE_NUMBER)
          ? numberCell(reference, style, value)
          : inlineCell(reference, style, value);
      });
      xml += '</row>';
    });

    xml += '</sheetData><drawing r:id="rId1"/></worksheet>';
    return xml;
  }

  function sheetRels() {
    return XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>' +
      '</Relationships>';
  }

  /**
   * One anchor per photo, pinned to column N of its own row.
   *
   * oneCellAnchor fixes the top-left corner to a cell and then states the size
   * outright, so the picture keeps its 5.56 x 2.81 cm regardless of what
   * anyone later does to the column width.
   */
  function drawing(placements) {
    var xml = XML_DECL +
      '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"' +
      ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">';

    placements.forEach(function (placement, index) {
      var id = index + 2;
      xml +=
        '<xdr:oneCellAnchor>' +
          '<xdr:from>' +
            '<xdr:col>13</xdr:col><xdr:colOff>' + INSET_EMU + '</xdr:colOff>' +
            '<xdr:row>' + placement.row + '</xdr:row><xdr:rowOff>' + INSET_EMU + '</xdr:rowOff>' +
          '</xdr:from>' +
          '<xdr:ext cx="' + PHOTO_WIDTH_EMU + '" cy="' + PHOTO_HEIGHT_EMU + '"/>' +
          '<xdr:pic>' +
            '<xdr:nvPicPr>' +
              '<xdr:cNvPr id="' + id + '" name="Photo ' + (index + 1) + '" descr="' +
                xmlEscape(placement.description) + '"/>' +
              '<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>' +
            '</xdr:nvPicPr>' +
            '<xdr:blipFill>' +
              '<a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
                ' r:embed="rId' + (index + 1) + '"/>' +
              '<a:stretch><a:fillRect/></a:stretch>' +
            '</xdr:blipFill>' +
            '<xdr:spPr>' +
              '<a:xfrm><a:off x="0" y="0"/>' +
              '<a:ext cx="' + PHOTO_WIDTH_EMU + '" cy="' + PHOTO_HEIGHT_EMU + '"/></a:xfrm>' +
              '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
            '</xdr:spPr>' +
          '</xdr:pic>' +
          '<xdr:clientData/>' +
        '</xdr:oneCellAnchor>';
    });

    return xml + '</xdr:wsDr>';
  }

  function drawingRels(count) {
    var xml = XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    for (var i = 1; i <= count; i++) {
      xml += '<Relationship Id="rId' + i +
        '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"' +
        ' Target="../media/image' + i + '.jpeg"/>';
    }
    return xml + '</Relationships>';
  }

  /* ── The public call ────────────────────────────────────────────────── */

  ARROW.xlsx = {
    PHOTO_WIDTH_CM: PHOTO_WIDTH_CM,
    PHOTO_HEIGHT_CM: PHOTO_HEIGHT_CM,
    HEADERS: HEADERS,

    /**
     * Builds the workbook from stored records.
     *
     * Each record contributes one row and one embedded photo. A record whose
     * photo is somehow missing still gets its row — a record without its
     * picture is still a record, and dropping it silently would be worse.
     */
    build: function (records, onProgress) {
      var Legacy = ARROW.Legacy;
      var rows = [];
      var placements = [];
      var photoJobs = [];

      records.forEach(function (record) {
        rows.push([
          Legacy.zone(record.zone),
          Legacy.segment(record.segment),
          Legacy.category(record.assetType),
          Legacy.kp(record.kp),
          Legacy.condition(record.condition),
          record.note || '',
          record.timestamp,
          record.latitude,
          record.longitude,
          record.street || '',
          record.subDistrict || '',
          record.district || '',
          record.regency || '',
          ''                                  // N holds the picture, not text
        ]);

        if (record.photo) {
          placements.push({
            row: rows.length,                 // 0-based: header is row 0
            description: Legacy.category(record.assetType) + ' ' + Legacy.kp(record.kp)
          });
          photoJobs.push(record.photo);
        }
      });

      var entries = [
        { name: '[Content_Types].xml', data: utf8(contentTypes()) },
        { name: '_rels/.rels', data: utf8(rootRels()) },
        { name: 'xl/workbook.xml', data: utf8(workbook()) },
        { name: 'xl/_rels/workbook.xml.rels', data: utf8(workbookRels()) },
        { name: 'xl/styles.xml', data: utf8(styles()) },
        { name: 'xl/worksheets/sheet1.xml', data: utf8(sheet(rows)) },
        { name: 'xl/worksheets/_rels/sheet1.xml.rels', data: utf8(sheetRels()) },
        { name: 'xl/drawings/drawing1.xml', data: utf8(drawing(placements)) },
        { name: 'xl/drawings/_rels/drawing1.xml.rels', data: utf8(drawingRels(photoJobs.length)) }
      ];

      // Photos are read one at a time. Reading forty at once would hold two
      // copies of every picture in memory at the peak, on the device least
      // able to spare it.
      return photoJobs.reduce(function (chain, blob, index) {
        return chain.then(function () {
          if (onProgress) onProgress(index, photoJobs.length);
          return bytesOf(blob).then(function (data) {
            entries.push({ name: 'xl/media/image' + (index + 1) + '.jpeg', data: data });
          });
        });
      }, Promise.resolve()).then(function () {
        if (onProgress) onProgress(photoJobs.length, photoJobs.length);
        return zip(entries);
      });
    }
  };
}(window.ARROW));
