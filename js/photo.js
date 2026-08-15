/* Turning a raw capture into the photo that gets stored: orient, resize, burn
   the information overlay into the pixels, compress.

   A port of PhotoProcessor.kt. The overlay is burned in rather than drawn over
   a preview because the pixels are the evidence — a photo that leaves the phone
   carries its own place and time, and nothing downstream can separate them. */

(function (ARROW) {

  /** The long edge every stored photo is reduced to. */
  var TARGET_MAX_DIMENSION = 1600;

  /** Roughly 400 KB per photo, enforced by stepping quality down if needed. */
  var MAX_FILE_BYTES = 400000;

  /** The list thumbnail. Decoding forty full photos to draw a list is how a
      phone gets slow; this keeps that off the main thread's critical path. */
  var THUMB_DIMENSION = 160;

  /**
   * Decodes a captured file with its EXIF rotation already applied.
   *
   * iPhone photos are almost always tagged rather than physically rotated, so
   * skipping this shows every portrait capture on its side.
   */
  function decodeOriented(file) {
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(file, { imageOrientation: 'from-image' })
        .catch(function () { return decodeViaImg(file); });
    }
    return decodeViaImg(file);
  }

  /* Safari applies EXIF orientation when it renders an <img>, so drawing one
     to a canvas gives the same result on the versions where
     createImageBitmap's imageOrientation option is missing. */
  function decodeViaImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read that photo'));
      };
      img.src = url;
    });
  }

  function drawScaled(source, maxDimension) {
    var width = source.width || source.naturalWidth;
    var height = source.height || source.naturalHeight;
    // Never upscale — enlarging a small capture adds no detail and costs size.
    var scale = Math.min(maxDimension / width, maxDimension / height, 1);
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function toBlob(canvas, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, 'image/jpeg', quality);
    });
  }

  /** Steps quality down only if needed, rather than trusting one fixed value. */
  function compress(canvas, ceiling) {
    var quality = 0.8;
    function attempt() {
      return toBlob(canvas, quality).then(function (blob) {
        if (blob.size <= ceiling || quality <= 0.3) return blob;
        quality -= 0.1;
        return attempt();
      });
    }
    return attempt();
  }

  /**
   * Draws the overlay permanently into the bottom-left of the photo.
   *
   * Same six lines as the Android app. The box is sized to the longest line
   * rather than a fixed fraction of the width, because the address line is the
   * one that varies and clipping it would lose the part hardest to reconstruct.
   */
  function burnOverlay(canvas, lines) {
    var context = canvas.getContext('2d');
    var fontSize = canvas.width * 0.035;

    function setFont(size) {
      context.font = '600 ' + size + 'px -apple-system, "Segoe UI", Roboto, sans-serif';
    }

    function widestLine() {
      return lines.reduce(function (widest, line) {
        return Math.max(widest, context.measureText(line).width);
      }, 0);
    }

    context.textBaseline = 'alphabetic';
    setFont(fontSize);

    /* The address line is the one that varies, and in Riau it runs long —
       "Jalan Duri, Bumbung, Kecamatan Mandau, Kabupaten Bengkalis". Rather
       than clip the part hardest to reconstruct later, shrink the type until
       the longest line fits. Text width scales linearly with font size and
       the padding is a fixed multiple of it, so the size that just fits can
       be solved for directly instead of guessed at in a loop. */
    var widest = widestLine();
    var limit = canvas.width;
    if (widest + fontSize * 1.2 > limit) {
      fontSize = limit / (widest / fontSize + 1.2);
      setFont(fontSize);
      widest = widestLine();
    }

    var lineHeight = fontSize * 1.3;
    var padding = fontSize * 0.6;
    var boxWidth = Math.min(widest + padding * 2, canvas.width);
    var boxHeight = lineHeight * lines.length + padding * 2;
    var boxTop = canvas.height - boxHeight;

    context.fillStyle = 'rgba(0, 0, 0, 0.55)';
    context.fillRect(0, boxTop, boxWidth, boxHeight);

    // A shadow so the text survives a bright sky behind a thin box edge.
    context.shadowColor = 'rgba(0, 0, 0, 0.9)';
    context.shadowBlur = 4;
    context.shadowOffsetX = 2;
    context.shadowOffsetY = 2;
    context.fillStyle = '#FFFFFF';

    lines.forEach(function (line, index) {
      var baseline = boxTop + padding + (index + 1) * lineHeight - lineHeight * 0.25;
      context.fillText(line, padding, baseline);
    });

    context.shadowColor = 'transparent';
    return canvas;
  }

  ARROW.photo = {

    /**
     * The six overlay lines. Blank ones are dropped, so a photo taken with no
     * address yet simply carries one line fewer.
     */
    overlayLines: function (meta) {
      var coordinates = (meta.latitude == null)
        ? 'Location unavailable'
        : 'Lat: ' + meta.latitude.toFixed(6) + ', Long: ' + meta.longitude.toFixed(6);

      return [
        'Segment ' + meta.segment + ', KP ' + meta.kp,
        meta.assetType,
        meta.condition,
        meta.timestamp,
        coordinates,
        meta.addressText
      ].filter(function (line) { return line && String(line).trim(); });
    },

    /**
     * Raw camera file in, stored photo out.
     *
     * Resolves to { blob, thumb, width, height }. Runs entirely on the device;
     * nothing here needs a network.
     */
    process: function (file, meta) {
      return decodeOriented(file).then(function (source) {
        var canvas = drawScaled(source, TARGET_MAX_DIMENSION);
        var thumbCanvas = drawScaled(source, THUMB_DIMENSION);
        if (source.close) source.close();   // release the ImageBitmap now

        burnOverlay(canvas, ARROW.photo.overlayLines(meta));

        return Promise.all([
          compress(canvas, MAX_FILE_BYTES),
          toBlob(thumbCanvas, 0.6)
        ]).then(function (results) {
          return {
            blob: results[0],
            thumb: results[1],
            width: canvas.width,
            height: canvas.height
          };
        });
      });
    }
  };
}(window.ARROW));
