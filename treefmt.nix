{
  projectRootFile = "flake.nix";

  programs = {
    # JSON / Markdown / TypeScript
    prettier = {
      enable = true;
      includes = [
        "*.json"
        "*.md"
        "*.ts"
      ];

      settings = {
        proseWrap = "never";
        # Tiny printWidth keeps all Markdown tables in the compact delimiter form.
        overrides = [
          {
            files = "*.md";
            options = {
              printWidth = 1;
              embeddedLanguageFormatting = "off";
            };
          }
        ];
      };
    };

    # Nix
    nixfmt = {
      enable = true;
    };

    # Shell
    shfmt = {
      enable = true;
    };

    # Python
    ruff-format = {
      enable = true;
    };

    # TOML
    taplo = {
      enable = true;
    };

    # YAML
    yamlfmt = {
      enable = true;
      excludes = [
        "pkgs/deepseek-harness-pnpm-lock.yaml"
        "pkgs/deepseek-harness-pnpm-workspace.yaml"
        "secrets/**/*.yaml"
      ];

      settings.formatter = {
        retain_line_breaks_single = true;
      };
    };
  };
}
