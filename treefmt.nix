{
  projectRootFile = "flake.nix";

  programs = {
    # JSON
    prettier = {
      enable = true;
      includes = [ "*.json" ];
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
