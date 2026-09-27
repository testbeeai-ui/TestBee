# Chapter PYQ — Practice and Test

**Status:** Approved in chat, pending spec review  
**Product:** EduBlast Web  
**Date:** 2026-09-27

## Goal

Each chapter set can be sat two ways. **Start Practice** keeps today’s full-set paper. **Start Test** asks for a length and a pace, draws that many questions at random from the set, and sits the same paper with a marks total.

## Decisions

| Topic | Choice |
|-------|--------|
| Approach | Setup step, then the existing exam session |
| Practice | Full set, 2 minutes per question, current correct-count review |
| Test questions | Random subset. Each Begin Test draws again from the full set and shuffles |
| Test clock | Question count × minutes per question |
| Marks | Right +4, wrong −1, blank 0. Maximum is 4 × question count |
| Tips, Formulas, Solution | Available in both modes. They do not change marks |
| Tip and formula mark rows | Not used |
| Try again | Resits the same test paper, same length, same clock |
| Assorted Test | Out of scope |
| Visual source | Existing chapter modal. The reference screenshots are the behavior, not a layout to copy |

## Where it shows

Both set lists get the two actions:

- The chapter popup on `/chapter-pyq`
- The set list on `/chapter-pyq/[subject]/[chapter]`

This covers Physics, Chemistry, and Mathematics. A year row and a numbered practice-set row behave the same way.

## Practice

**Start Practice** opens every question in that set, in the current order, at 2 minutes each. The result stays “correct / total”, with correct, wrong, and skipped counts. There is no setup step and no marks total.

## Test setup

**Start Test** opens a setup step for that one set.

- Question count starts at the set size. It must be a whole number from 1 through the set size.
- Minutes per question starts at 2. It must be a whole number of 1 or more.
- Total time is count × minutes, and it updates while they edit.
- **Begin Test** is available only when both values are valid.
- **Cancel** returns to the set list and starts nothing.

A value above the set size, below 1, blank, or not a whole number does not start a paper.

## The draw

**Begin Test** shuffles that set and takes the requested count. Two begins in a row are different draws, including a different order. The draw is fixed for that sitting.

**Try this set again** uses that same list, same order, same count, and same minutes. It does not draw again.

## The paper

Test and Practice use the same exam screen: options, numeric entry, Save & Next, Clear, review flags, Tips, Formulas, and Solution. The test clock is the total from setup. Opening Tips or Formulas does not change a right answer’s marks.

Answered questions still update the chapter card’s Attempted, Right, and Wrong counts, in either mode.

## Score

For a test of N questions:

- Each right answer adds 4.
- Each wrong answer subtracts 1.
- Each blank adds 0.
- Maximum marks are 4 × N.

The test result shows the marks (for example 11 / 36) and the correct, wrong, and skipped counts. Practice results do not show marks.

## Checks

- Practice still opens the full set at 2 minutes per question and ends on a correct count.
- A test cannot request more questions than the set contains.
- A test cannot start with a count below 1 or minutes below 1.
- Total time equals count × minutes.
- Each Begin Test draws independently from the full set. A one-question set can only draw that question.
- Try again repeats the sitting just finished.
- A right answer is +4 with or without Tips or Formulas. A wrong answer is −1. A blank is 0.
