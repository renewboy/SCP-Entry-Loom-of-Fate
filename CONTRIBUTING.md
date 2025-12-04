
# Contributing to SCP Entry: Loom of Fate

First off, thank you for considering contributing to SCP Entry: Loom of Fate! It's people like you that make the open source community such an amazing place to learn, inspire, and create.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

*   **Use a clear and descriptive title** for the issue to identify the problem.
*   **Describe the exact steps to reproduce the problem** in as much detail as possible.
*   **Provide specific examples** to demonstrate the steps.
*   **Describe the behavior you observed** after following the steps and point out what exactly is the problem with that behavior.
*   **Explain which behavior you expected to see instead** and why.
*   **Include screenshots** if possible.

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion, including completely new features and minor improvements to existing functionality.

*   **Use a clear and descriptive title** for the issue to identify the suggestion.
*   **Provide a step-by-step description of the suggested enhancement** in as much detail as possible.
*   **Explain why this enhancement would be useful** to most users.

### Pull Requests

The process described here has several goals:

- Maintain the quality of the code.
- Fix problems that are important to users.
- Engage the community in working toward the best possible product.

1.  Fork the repo and create your branch from `main`.
2.  If you've added code that should be tested, add tests.
3.  Ensure the test suite passes.
4.  Make sure your code follows the existing style patterns (React functional components, TypeScript, Tailwind CSS).
5.  Issue that pull request!

## Development Setup

1.  Clone the repository.
2.  Install dependencies: `npm install`.
3.  Create a `.env` file with your `API_KEY` (see README).
4.  Run the development server: `npm start`.

## Styleguides

### Git Commit Messages

*   Use the present tense ("Add feature" not "Added feature").
*   Use the imperative mood ("Move cursor to..." not "Moves cursor to...").
*   Limit the first line to 72 characters or less.
*   Reference issues and pull requests liberally after the first line.

### JavaScript/TypeScript Styleguide

*   This project uses **TypeScript**. Please ensure all new code is strongly typed.
*   We use **React Hooks** for state management.
*   Styling is handled via **Tailwind CSS**. Avoid writing custom CSS in `<style>` blocks unless necessary for complex animations or legacy terminal effects.
*   Follow the Google GenAI SDK guidelines found in the prompt instructions if modifying API calls.

## Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.
