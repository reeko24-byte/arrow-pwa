/* ARROW vocabulary — a direct port of AssetOptions.kt and
   LegacyReportFormat.kt from the Android app.

   The reference data was normalised *into* ARROW's terms when it was imported;
   the Excel goes the other way, because three surveys and a signed report
   already speak the old vocabulary. Changing anything here silently splits one
   asset type into two in the month-over-month comparison. */

var ARROW = window.ARROW || {};

ARROW.OPTIONS = {
  zones: ['North', 'South'],

  segmentsByZone: {
    North: ['6', '7', '8', '9', '10/12', '11A', '11B'],
    South: ['1', '2', '3', '4', '5']
  },

  assetTypes: [
    'Pig Launcher', 'Pig Receiver', 'SBV', 'Pump Booster', 'Tie-In',
    'Cathodic', 'Boundary', 'Warning Sign Small', 'Warning Sign Large',
    'Obvitnas Sign', 'KP Sign'
  ],

  conditions: ['Good', 'Damaged', 'Missing']
};

ARROW.Legacy = (function () {
  var CATEGORY_TO_LEGACY = {
    'Pig Launcher': 'Launcher',
    'Pig Receiver': 'Receiver',
    'Obvitnas Sign': 'Sign OBVITNAS'
  };

  return {
    /** "North" -> "North Zone" */
    zone: function (zone) { return zone + ' Zone'; },

    /** "10/12" -> "Segment 10/12" */
    segment: function (segment) { return 'Segment ' + segment; },

    /** "Pig Launcher" -> "Launcher"; anything unmapped passes through. */
    category: function (assetType) {
      return CATEGORY_TO_LEGACY[assetType] || assetType;
    },

    /** "45+000" -> "45 + 000", the spacing used throughout the existing data. */
    kp: function (kp) {
      var parts = String(kp).split('+');
      return parts.length === 2 ? parts[0] + ' + ' + parts[1] : kp;
    },

    /** "Good" -> "GOOD" */
    condition: function (condition) { return String(condition).toUpperCase(); }
  };
}());

/** Turns raw digits into the fixed KP shape: two digits, "+", three digits. */
ARROW.formatKp = function (rawInput) {
  var digitsOnly = String(rawInput).replace(/\D/g, '').slice(0, 5);
  return digitsOnly.length > 2
    ? digitsOnly.slice(0, 2) + '+' + digitsOnly.slice(2)
    : digitsOnly;
};

/** A complete KP is exactly "XX+XXX". */
ARROW.isKpComplete = function (kp) { return String(kp).length === 6; };

/* ── Time ─────────────────────────────────────────────────────────────── */

function pad2(n) { return n < 10 ? '0' + n : String(n); }

/** "2026-08-14" — the date half of the report's Timestamp column. */
ARROW.dateOf = function (d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
};

/** "14:25:30" */
ARROW.timeOf = function (d) {
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
};

/** "2026-08-14 14:25:30" — one column, as the report wants it. */
ARROW.timestampOf = function (d) {
  return ARROW.dateOf(d) + ' ' + ARROW.timeOf(d);
};

/** "20260814_142530", for the filename. */
ARROW.stampOf = function (d) {
  return ARROW.dateOf(d).replace(/-/g, '') + '_' + ARROW.timeOf(d).replace(/:/g, '');
};

/** Strips anything that would upset a filename or a WhatsApp attachment. */
ARROW.fileSafe = function (name) {
  return String(name).trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Operator';
};

window.ARROW = ARROW;
