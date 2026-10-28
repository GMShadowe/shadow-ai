---
name: Summarize a document
description: Read a whole file and summarize it properly — what it is, what it actually says, and what it leaves out.
tools: read_file, list_dir, find_files
---

# Summarizing a document

A summary is not the first paragraph retold. It is what someone would need
to know if they were never going to read the document themselves.

## Do this in order

1. **Read the whole thing first.** Call `read_file` on the file before you
   write a single word. If the tool says the file was truncated, say so in
   your answer — never summarize part of a file and present it as the whole.
2. **Work out what kind of document it is** before summarizing it: notes,
   a guide, a log, a transcript, a spec, a story, a config. The kind decides
   what matters. A log's summary is patterns and anomalies; a guide's
   summary is the steps; a transcript's summary is who wanted what.
3. **Find the claims, not the headings.** Headings tell you how it is
   organised, not what it says. A summary built from headings is useless.
4. **Keep every number, name, version, date and limit** that carries
   meaning. These are the first things a lazy summary loses and the first
   things the reader needs.
5. **Separate what the document says from what you think.** If you add an
   observation of your own, label it.

## Shape of the answer

Use your own wording for these, not the labels below.

- **One sentence** saying what the document is and who it is for.
- **The substance**, as 3-7 bullets. Each bullet is a claim with its
  specifics attached, not a topic label. "Chunk size is capped at 8000
  characters because the 2B model drowns above that" — not "discusses
  chunk sizes".
- **Structure**, one line, only if it helps: how long it is and how it is
  organised.
- **Gaps and uncertainty**: anything the document raises and never answers,
  anything contradictory, anything you could not read. If there is nothing,
  say "nothing obviously missing" rather than dropping the section.

## Mistakes to catch before you answer

- Summarizing the introduction and stopping.
- Turning examples into recommendations. If the document says "for example,
  some teams use X", it is not telling anyone to use X.
- Smoothing over a contradiction to make the summary tidy. Point it out.
- Inventing a conclusion the document never draws.
- Padding with "this document discusses…" phrasing. Say the thing itself.

Match the summary's length to the document: a page gets a few bullets, a
long report gets the full layout above. Never pad to look thorough.
