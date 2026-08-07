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
        "*.tsx"
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

    # TOML
    taplo = {
      enable = true;
    };

    # YAML
    yamlfmt = {
      enable = true;
      excludes = [ "secrets/**/*.yaml" ];

      settings.formatter = {
        retain_line_breaks_single = true;
      };
    };
  };
}
