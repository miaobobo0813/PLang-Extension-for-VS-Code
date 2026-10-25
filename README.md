# PLang Extension for VS Code

Language support for [PLang](https://github.com/miaobobo0813/PLang) files in Visual Studio Code.

## Features

- Syntax highlighting for `.plang` files.
- IntelliSense completions for PLang keywords, modifiers, variables, operators, and types.
- Live syntax and compilation diagnostics from the PLang compiler, run with `--no-output`.
- Compiler errors with line and column information are underlined. Errors without a source location appear in the Problems panel without an underline.

## Requirements

- Visual Studio Code 1.140.0 or later.
- The PLang compiler is required for live diagnostics. IntelliSense completions work without it.

The extension starts the compiler as `plang`. Ensure it is available on the VS Code process's `PATH`.

Launch VS Code from that PowerShell session for the environment variable to be inherited. The compiler is run with `--no-output --code` against the current editor contents, so diagnostics also reflect unsaved changes.

## License

MIT License. See [LICENSE.md](LICENSE.md).
