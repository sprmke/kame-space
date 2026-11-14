# Poster rubric

Score each poster 1 to 5 on every axis, then answer the last two. Score blind: the scorer does not know which engine or layout made it. Use the contact sheet (`bun run marketing:contact-sheet`) as the source of posters.

| Axis                                        | 1                                                              | 3                                    | 5                                                     |
| ------------------------------------------- | -------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------- |
| Legibility                                  | Text is hard to read or clipped                                | Readable, small support text is weak | Every line reads at phone size on first look          |
| Hierarchy                                   | No clear first read                                            | A first read exists, competing lines | One hero line, one support line, one fact module      |
| Photo respect                               | Text covers the subject or the photo is stretched or cut badly | Subject is visible, crop is average  | Subject is clear, crop and scrim suit the photo       |
| Restraint                                   | Many fonts, badges and effects                                 | A few extras                         | Only what the message needs                           |
| Brand consistency                           | Colors and type ignore the theme                               | Mostly the theme                     | Reads as the same brand as the theme and logo         |
| Factual accuracy                            | An invented or wrong fact                                      | A vague claim                        | Every fact comes from the listing or the host's offer |
| Looks template-made (inverse: 5 = does not) | Obvious stock template                                         | Some template feel                   | Looks designed for this property                      |

Then:

- **Would post as is:** yes or no.
- **Broken render:** yes or no (missing photo, clipped text, error block). Any yes fails the set.

## Ship gate (plan 0.7)

For a 24-poster set judged blind: mean at least 4.0 on every axis, at least 70% "would post as is", zero broken renders, zero fact errors.

## How to score

1. Run the sheet for the layouts or presets under review and open `index.html`.
2. Shuffle the cells, hide the file names, and score one poster at a time on the table above.
3. Record scores in the plan under 0.6 (baseline) and in the review note of the slice being shipped.
