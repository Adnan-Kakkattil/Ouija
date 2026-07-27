"use strict";

/**
 * Olivia's local investigation portal — intentional IDOR.
 * Public index lists only unclassified reports; any numeric id still fetches.
 */

const express = require("express");

const router = express.Router();

const REPORTS = {
  1: {
    id: 1,
    title: "Parish missing-persons bulletin",
    classification: "public",
    summary: "Three disappearances noted near Hollow Road since autumn.",
    body:
      "Public notice only. Names withheld at the family's request. No evidence of forced entry was reported to the parish desk.",
  },
  2: {
    id: 2,
    title: "Mansion grounds survey",
    classification: "public",
    summary: "Exterior photographs and boundary notes for Blackmoor House.",
    body:
      "The upper windows show recent light wear. The cellar hatch remains barred from the outside. Local folklore attributes this to 'keeping spirits in.'",
  },
  3: {
    id: 3,
    title: "Interview: neighbour on Hollow Road",
    classification: "public",
    summary: "Witness heard a melody after midnight; declined further comment.",
    body:
      "The neighbour insists the house has been empty since 1961. They asked that this statement remain on the public board only.",
  },
  4: {
    id: 4,
    title: "Supply inventory — investigation room",
    classification: "internal",
    summary: "Camera, recorder, and microfilm slips checked out to O.H.",
    body:
      "Internal logistics only. Not for parish publication. Red-string board photographed 11 Oct.",
  },
  5: {
    id: 5,
    title: "Draft: folklore vs. physical evidence",
    classification: "internal",
    summary: "Olivia's working notes comparing ghost stories to floorboard finds.",
    body:
      "The stories do not match the physical record. Defer conclusion until basement access is possible.",
  },
  /* Deliberately omitted from the public index — IDOR target */
  7: {
    id: 7,
    title: "RESTRICTED — Cause of death assessment",
    classification: "restricted",
    summary: "Final medical-forensic conclusion on Olivia H.",
    body:
      "CONFIDENTIAL — not for public release.\n\n" +
      "After reviewing the scene photographs, the recorder fragment, and the basement access notes, " +
      "this office no longer accepts a paranormal explanation.\n\n" +
      "Conclusion: Olivia's death was a deliberate murder, not an accident and not a haunting.\n\n" +
      "flag{murder_not_accident}\n\n" +
      "File owner: O.H. · Do not reassign without clerk approval.",
  },
};

function publicList() {
  return Object.values(REPORTS)
    .filter((r) => r.classification === "public")
    .map((r) => ({
      id: r.id,
      title: r.title,
      classification: r.classification,
      summary: r.summary,
    }));
}

router.get("/reports", (_req, res) => {
  res.json({
    ok: true,
    portal: "Hollow Road Investigation Desk",
    note: "Showing records assigned to the public board.",
    reports: publicList(),
  });
});

router.get("/reports/:id", (req, res) => {
  const id = String(req.params.id || "").trim();
  const report = REPORTS[id];
  if (!report) {
    return res.status(404).json({
      ok: false,
      message: "No record under that reference.",
    });
  }
  /* Intentionally no ownership / classification gate — IDOR */
  res.json({ ok: true, report });
});

module.exports = router;
