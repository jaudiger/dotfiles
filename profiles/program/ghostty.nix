{ ... }:

{
  modules.home-manager = {
    programs.ghostty = {
      enable = true;

      # TODO: to remove once the package is consider as not broken on MacOS
      package = null;

      settings = {
        font-family = "JetBrainsMono Nerd Font";
        font-size = 11.5;

        selection-invert-fg-bg = true;
        cursor-invert-fg-bg = true;
        minimum-contrast = 1.05;
        mouse-hide-while-typing = true;

        background-opacity = 0.8;
        background-blur = true;

        resize-overlay = "never";

        auto-update = "off";
      };
    };
  };
}
