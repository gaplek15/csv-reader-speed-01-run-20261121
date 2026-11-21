// solve.js
export function run(input) {
  const text = input.text;
  const length = text.length;
  const header = !!input.header;
  const delimiters = /[,\r\n]/g;

  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let width = -1;
  let columns = null;
  let fields = [];
  let active = false;

  const rows = [];
  const errors = [];

  function error(code) {
    errors.push({
      code,
      line: recordLine,
      row: header && width < 0 ? null : rows.length
    });
  }

  function finishRecord() {
    if (width < 0) {
      width = fields.length;
      if (header) columns = fields;
      else rows.push(fields);
    } else {
      const count = fields.length;
      if (count < width) {
        errors.push({
          code: "short_row",
          line: recordLine,
          row: rows.length,
          fields: count
        });
        while (fields.length < width) fields.push("");
      } else if (count > width) {
        errors.push({
          code: "long_row",
          line: recordLine,
          row: rows.length,
          extra: fields.slice(width)
        });
        fields.length = width;
      }
      rows.push(fields);
    }
    fields = [];
    active = false;
  }

  while (pos < length || fields.length !== 0) {
    let value = "";
    let quoted = false;
    let junk = false;

    if (text.charCodeAt(pos) === 34) {
      active = true;
      const opening = pos;
      let search = pos + 1;
      let closing = -1;
      let doubled = false;

      while (search < length) {
        const quote = text.indexOf('"', search);
        if (quote < 0) break;
        if (text.charCodeAt(quote + 1) === 34) {
          doubled = true;
          search = quote + 2;
        } else {
          closing = quote;
          break;
        }
      }

      if (closing >= 0) {
        quoted = true;
        value = text.slice(opening + 1, closing);
        if (doubled) value = value.replace(/""/g, '"');
        if (value.indexOf("\r") >= 0) {
          value = value.replace(/\r\n?/g, "\n");
        }
        let newline = value.indexOf("\n");
        while (newline >= 0) {
          ++line;
          newline = value.indexOf("\n", newline + 1);
        }
        pos = closing + 1;
      } else {
        error("unterminated_quote");
      }
    }

    // Scan an unquoted field, or the suffix after a closing quote.
    // The regular expression searches whole spans in native code.
    let segment = pos;
    let delimiter = -1;

    for (;;) {
      delimiters.lastIndex = pos;
      const match = delimiters.exec(text);
      const end = match === null ? length : match.index;

      if (end > segment) {
        const piece = text.slice(segment, end);
        value += piece;
        if (quoted) junk = true;
      }

      if (match === null) {
        pos = length;
        break;
      }

      const code = text.charCodeAt(end);
      if (code === 13 && text.charCodeAt(end + 1) !== 10) {
        error("stray_cr");
        pos = end + 1;
        segment = pos;
        continue;
      }

      delimiter = code;
      pos = end;
      break;
    }

    if (junk) error("quote_junk");
    if (value.length !== 0) active = true;

    if (delimiter === 44) {
      fields.push(value);
      active = true;
      ++pos;
      continue;
    }

    if (active || fields.length !== 0) {
      fields.push(value);
      finishRecord();
    }

    if (delimiter < 0) break;

    pos += delimiter === 13 ? 2 : 1;
    ++line;
    recordLine = line;
  }

  return { columns, rows, errors };
}
