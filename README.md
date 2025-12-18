# Talasius

Welcome to the **Talasius** project! This is a static site built with [Hugo](https://gohugo.io/) using the [Blowfish](https://blowfish.page/) theme.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

*   **Hugo**: You need the **extended** version of Hugo to support the features used by the Blowfish theme.
    *   [Installation Guide](https://gohugo.io/installation/)
    *   Verify with: `hugo version` (Look for "extended" in the output)

## Installation

1.  **Clone the repository**:

    ```bash
    git clone --recursive https://github.com/numynox/talasius.git
    cd talasius
    ```

2.  **Update Submodules** (if you cloned without `--recursive`):

    ```bash
    git submodule update --init --recursive
    ```

## Running Locally

To start the local development server:

```bash
hugo server
```

This will build the site and serve it at `http://localhost:1313/talasius` (or another port if 1313 is in use). The server supports live reloading, so changes to content or configuration will automatically update the page.

## Configuration

*   **Main Configuration**: The main configuration files are located in `config/_default/`.
*   **Theme**: This site uses the [Blowfish](https://github.com/nunocoracao/blowfish) theme. Theme-specific configuration can be found in `config/_default/params.toml` and other files in that directory.
