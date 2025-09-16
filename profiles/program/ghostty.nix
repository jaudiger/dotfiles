{ ... }:

{
  modules.home-manager = {
    programs.ghostty = {
      enable = true;

      # TODO: to remove once the package is consider as not broken on macOS
      package = null;

      settings = {
        font-family = "JetBrainsMono Nerd Font";
        font-size = 11.5;

        selection-foreground = "cell-background";
        selection-background = "cell-foreground";
        cursor-color = "cell-foreground";
        cursor-text = "cell-background";
        minimum-contrast = 1.05;
        mouse-hide-while-typing = true;

        background-opacity = 0.8;
        background-blur = true;

        resize-overlay = "never";

        quick-terminal-size = "25%,75%";
        quick-terminal-position = "center";

        auto-update = "off";
      };
    };
  };
}
