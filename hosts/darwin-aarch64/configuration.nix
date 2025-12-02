{ config, pkgs, ... }:

let
  host = config.modules.host;
in
{
  config = {
    # Default config
    modules = {
      host = {
        username = "jaudiger";

        # TODO: To be moved inside configuration files
        shell.nonPortableAliases = {
          intellij = "open -na 'IntelliJ IDEA CE'";
        };
      };

      # Default packages
      home-manager = {
        home = {
          packages = with pkgs; [
            # Replace default 'openssl' since it's out of date
            openssl
          ];
        };
      };
    };

    homebrew = {
      enable = true;

      global = {
        autoUpdate = false;
        brewfile = true;
      };

      onActivation = {
        autoUpdate = true;
        upgrade = true;
        cleanup = "zap";
      };

      taps = [
        "daveshanley/vacuum"
        "iann0036/iamlive"
        "lihaoyun6/tap"
        "osx-cross/avr"
      ];

      brews = [
        "avr-gcc"
        "iamlive"
        "qemu"
        "vacuum"
        "lima"
        "lima-additional-guestagents"
      ];

      greedyCasks = true;

      casks = [
        "logi-options+"
        "wireshark-app"
        "docker-desktop"
        "ghostty"
        "visual-studio-code"
        "zed@preview"
        "intellij-idea-ce"
        "insomnia"
        "discord"
        "microsoft-teams"
        "zoom"
        "steam"
        "retroarch"
        "claude"
        "chatgpt"
        "freecad"
        "sweet-home3d"
      ];

      masApps = {
        # To look for new apps: 'mas search MY_APP'
        "myCANAL" = 694580816;
        "Numbers" = 409203825;
        "Pages" = 409201541;
        "Keynote" = 409183694;
      };
    };

    # Add ability to used TouchID or Apple Watch for sudo authentication
    security.pam.services.sudo_local.touchIdAuth = true;
    security.pam.services.sudo_local.watchIdAuth = true;

    # FIXME: See:
    # - https://github.com/nix-community/home-manager/issues/4026#issuecomment-1565974702
    # - https://github.com/nix-darwin/nix-darwin/issues/682
    users.users.${host.username} = {
      home = host.homeDirectory;
      shell = pkgs.zsh;
    };

    system.primaryUser = host.username;

    # Power parameters
    power.restartAfterFreeze = true;

    # Startup parameters
    system.startup.chime = false;

    # Global parameters
    system.defaults.NSGlobalDomain.AppleFontSmoothing = 1;
    system.defaults.NSGlobalDomain.AppleIconAppearanceTheme = "RegularAutomatic";
    system.defaults.NSGlobalDomain.InitialKeyRepeat = 20;
    system.defaults.NSGlobalDomain.KeyRepeat = 1;
    system.defaults.NSGlobalDomain.AppleInterfaceStyleSwitchesAutomatically = true;
    system.defaults.NSGlobalDomain.AppleShowAllExtensions = true;
    system.defaults.NSGlobalDomain.AppleScrollerPagingBehavior = true;
    system.defaults.NSGlobalDomain.NSStatusItemSelectionPadding = 8;
    system.defaults.NSGlobalDomain.NSStatusItemSpacing = 12;
    system.defaults.NSGlobalDomain.NSTableViewDefaultSizeMode = 1; # Size of the finder sidebar icons
    system.defaults.NSGlobalDomain.NSTextShowsControlCharacters = true;
    system.defaults.NSGlobalDomain.NSUseAnimatedFocusRing = false;
    system.defaults.NSGlobalDomain.NSNavPanelExpandedStateForSaveMode = true;
    system.defaults.NSGlobalDomain.NSNavPanelExpandedStateForSaveMode2 = true;
    system.defaults.NSGlobalDomain.NSWindowShouldDragOnGesture = true;
    system.defaults.NSGlobalDomain.PMPrintingExpandedStateForPrint = true;
    system.defaults.NSGlobalDomain.PMPrintingExpandedStateForPrint2 = true;
    system.defaults.NSGlobalDomain."com.apple.springing.delay" = 0.1;

    # Stage manager parameters
    system.defaults.WindowManager.GloballyEnabled = false;
    system.defaults.WindowManager.AutoHide = true;
    system.defaults.WindowManager.EnableTilingByEdgeDrag = true;
    system.defaults.WindowManager.EnableTopTilingByEdgeDrag = true;
    system.defaults.WindowManager.EnableTilingOptionAccelerator = true;
    system.defaults.WindowManager.EnableTiledWindowMargins = true;

    # Login parameters
    system.defaults.loginwindow.GuestEnabled = false;
    system.defaults.loginwindow.RestartDisabled = true;
    system.defaults.loginwindow.ShutDownDisabled = true;
    system.defaults.loginwindow.SleepDisabled = true;

    # Finder parameters
    system.defaults.finder.AppleShowAllExtensions = true;
    system.defaults.finder.AppleShowAllFiles = true;
    system.defaults.finder.CreateDesktop = false;
    system.defaults.finder.FXDefaultSearchScope = "SCcf"; # Current folder
    system.defaults.finder.FXEnableExtensionChangeWarning = false;
    system.defaults.finder.FXPreferredViewStyle = "clmv"; # Column View
    system.defaults.finder.FXRemoveOldTrashItems = true; # Remove items in the trash after 30 days
    system.defaults.finder.NewWindowTarget = "Home";
    system.defaults.finder.QuitMenuItem = true;
    system.defaults.finder.ShowPathbar = true;
    system.defaults.finder.ShowStatusBar = true;

    # Dock parameters
    system.defaults.dock.autohide = true;
    system.defaults.dock.autohide-delay = 0.1;
    system.defaults.dock.autohide-time-modifier = 0.5;
    system.defaults.dock.expose-group-apps = false;
    system.defaults.dock.launchanim = false;
    system.defaults.dock.mineffect = "genie";
    system.defaults.dock.expose-animation-duration = 0.1;
    system.defaults.dock.minimize-to-application = true;
    system.defaults.dock.mouse-over-hilite-stack = true;
    system.defaults.dock.mru-spaces = false;
    system.defaults.dock.orientation = "left";
    system.defaults.dock.persistent-others = [ "${host.homeDirectory}/Development/git-repositories" ];
    system.defaults.dock.show-recents = false;
    system.defaults.dock.showhidden = true;
    system.defaults.dock.tilesize = 42;
    system.defaults.dock.wvous-bl-corner = 11; # Launchpad
    system.defaults.dock.wvous-br-corner = 1; # Disabled
    system.defaults.dock.wvous-tl-corner = 2; # Mission Control
    system.defaults.dock.wvous-tr-corner = 1; # Disabled

    # Calendar parameters
    system.defaults.iCal."first day of week" = "Monday";
    system.defaults.iCal.CalendarSidebarShown = true;
    system.defaults.iCal."TimeZone support enabled" = true;

    # Activity Monitor parameters
    system.defaults.ActivityMonitor.IconType = 5;
    system.defaults.ActivityMonitor.ShowCategory = 100; # All Processes
    system.defaults.ActivityMonitor.SortColumn = "CPUUsage";
    system.defaults.ActivityMonitor.SortDirection = 0; # Descending

    # Screencapture parameters
    system.defaults.screencapture.disable-shadow = true;
    system.defaults.screencapture.target = "clipboard";
    system.defaults.screencapture.location = "/tmp"; # If target is "file", the location is the folder

    system = {
      # Used for backwards compatibility, please read the changelog before changing.
      stateVersion = 4;
    };
  };

  # Import files to setup the environment
  imports = [
    ../../profiles/development/default.nix
    ../../profiles/program/default.nix
    ../../profiles/system/default.nix
  ];
}
