{
  config,
  lib,
  ...
}:

let
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
in
{
  homebrew = lib.mkIf isDarwin {
    casks = [ "ghostty" ];
  };

  modules.home-manager = {
    programs.ghostty = {
      enable = true;
      systemd.enable = false;

      # NOTE: nixpkgs marks ghostty as broken on Darwin, using Homebrew instead
      package = lib.mkIf isDarwin null;

      settings = {
        font-family = "JetBrainsMono Nerd Font";
        font-size = 11.5;

        cursor-color = "cell-foreground";
        cursor-text = "cell-background";
        minimum-contrast = 1.05;
        mouse-hide-while-typing = true;
        selection-background = "cell-foreground";
        selection-foreground = "cell-background";

        background-blur = true;
        background-opacity = 0.8;

        resize-overlay = "never";

        quick-terminal-position = "center";
        quick-terminal-size = "25%,75%";

        split-inherit-working-directory = true;
        split-preserve-zoom = "navigation";

        notify-on-command-finish = "unfocused";

        auto-update = "off";
      };
    };
  };
}
