# Echo PDK Examples

This directory contains example Echo templates demonstrating various features.

## Examples

### Movie Recommender

**File:** `movie-recommender.echo`

Demonstrates:
- Variable substitution: `{{companions}}`, `{{genre}}`
- Conditionals with `#contains` operator
- Conditionals with `#equals` operator
- Context-dependent content

**Run:**
```bash
echopdk render movie-recommender.echo --context-file movie-recommender.context.json
```

**Expected output:**
```
You are a Context-Aware Movie Curator.

Your goal is to recommend the perfect movie based on who I am watching with (Shimon) and the preferred genre (SciFi).

**Watching with Shimon - Rules:**
* **Preference:** We love 80s/90s Action or Sci-Fi cult classics.
* **Constraint:** Do not recommend anything released after 2015 unless it has a rating above 8.5 on IMDB.

Based on the constraints above, recommend ONE movie. Explain why it fits the specific requirements for this viewing context.
```

### Customer Support

**File:** `customer-support.echo`

Demonstrates:
- Default values: `{{company ?? "our company"}}`
- Section definitions: `[#SECTION name="greeting"]`
- Section includes: `[#INCLUDE greeting]`
- Nested conditionals
- Multiple operators: `#equals`, `#lte`, `#exists`

## Creating Your Own

1. Create a `.echo` file with your template
2. Create a `.context.json` file with sample data
3. Run: `echopdk render your-template.echo --context-file your-context.json`

## Syntax Quick Reference

```
{{variable}}                    # Variable
{{var ?? "default"}}           # Default value
[#IF {{x}} #equals(y)]...[END IF]    # Conditional
[#SECTION name="x"]...[END SECTION]  # Section definition
[#INCLUDE x]                   # Section include
[#IMPORT ./path.echo]          # Import file
```
