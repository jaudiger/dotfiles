{ ... }:

{
  modules = {
    home-manager = {
      programs.carapace = {
        enable = true;
      };
    };

    host.shell.sessionVariables = {
      # Set the fallback completions
      # https://rsteube.github.io/carapace-bin/release_notes/v0.30.html#implicit-bridges
      CARAPACE_BRIDGES = "zsh,bash";
    };
  };
}
