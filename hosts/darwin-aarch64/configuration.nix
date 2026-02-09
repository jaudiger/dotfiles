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
      };

      # Default packages
      home-manager = {
        home = {
          packages = with pkgs; [
            # Replace default 'openssl' since it's out of date
            openssl
          ];

          # Suppress "Last login" message in terminal
          file.".hushlogin".text = "";
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
      ];

      greedyCasks = true;

      masApps = {
        # To look for new apps: 'mas search MY_APP'
        "myCANAL" = 694580816;
        "Numbers" = 409203825;
        "Pages" = 409201541;
        "Keynote" = 409183694;
      };
    };

    # Add ability to use TouchID or Apple Watch for sudo authentication
    security.pam.services.sudo_local.touchIdAuth = true;
    security.pam.services.sudo_local.watchIdAuth = true;

    # NOTE: See:
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

    # Trackpad parameters
    system.defaults.trackpad.Clicking = true;
    system.defaults.trackpad.Dragging = true;
    system.defaults.trackpad.TrackpadRightClick = true;
    system.defaults.trackpad.TrackpadThreeFingerDrag = true;

    # Global parameters
    system.defaults.NSGlobalDomain.AppleIconAppearanceTheme = "RegularAutomatic";
    system.defaults.NSGlobalDomain.AppleInterfaceStyleSwitchesAutomatically = true;
    system.defaults.NSGlobalDomain.AppleScrollerPagingBehavior = true;
    system.defaults.NSGlobalDomain.AppleShowAllExtensions = true;
    system.defaults.NSGlobalDomain."com.apple.springing.delay" = 0.1;
    # Keyboard
    system.defaults.NSGlobalDomain.ApplePressAndHoldEnabled = false;
    system.defaults.NSGlobalDomain.InitialKeyRepeat = 20;
    system.defaults.NSGlobalDomain.KeyRepeat = 1;
    # Text correction (disabled for coding)
    system.defaults.NSGlobalDomain.NSAutomaticCapitalizationEnabled = false;
    system.defaults.NSGlobalDomain.NSAutomaticDashSubstitutionEnabled = false;
    system.defaults.NSGlobalDomain.NSAutomaticPeriodSubstitutionEnabled = false;
    system.defaults.NSGlobalDomain.NSAutomaticQuoteSubstitutionEnabled = false;
    system.defaults.NSGlobalDomain.NSAutomaticSpellingCorrectionEnabled = false;
    # Save/Print dialogs
    system.defaults.NSGlobalDomain.NSNavPanelExpandedStateForSaveMode = true;
    system.defaults.NSGlobalDomain.NSNavPanelExpandedStateForSaveMode2 = true;
    system.defaults.NSGlobalDomain.PMPrintingExpandedStateForPrint = true;
    system.defaults.NSGlobalDomain.PMPrintingExpandedStateForPrint2 = true;
    # Status bar
    system.defaults.NSGlobalDomain.NSStatusItemSelectionPadding = 8;
    system.defaults.NSGlobalDomain.NSStatusItemSpacing = 12;
    # Misc
    system.defaults.NSGlobalDomain.NSTableViewDefaultSizeMode = 1; # Size of the finder sidebar icons
    system.defaults.NSGlobalDomain.NSTextShowsControlCharacters = true;
    system.defaults.NSGlobalDomain.NSUseAnimatedFocusRing = false;
    system.defaults.NSGlobalDomain.NSWindowShouldDragOnGesture = true;
    # iCloud
    system.defaults.NSGlobalDomain.NSDocumentSaveNewDocumentsToCloud = false;
    # Inline predictive text
    system.defaults.NSGlobalDomain.NSAutomaticInlinePredictionEnabled = false;
    # Scrollbar
    system.defaults.NSGlobalDomain.AppleShowScrollBars = "WhenScrolling";
    # Regional
    system.defaults.NSGlobalDomain.AppleICUForce24HourTime = true;
    system.defaults.NSGlobalDomain.AppleMeasurementUnits = "Centimeters";
    system.defaults.NSGlobalDomain.AppleMetricUnits = 1;
    system.defaults.NSGlobalDomain.AppleTemperatureUnit = "Celsius";

    # Window Manager parameters
    system.defaults.WindowManager.EnableStandardClickToShowDesktop = false;

    # Login parameters
    system.defaults.loginwindow.DisableConsoleAccess = true;
    system.defaults.loginwindow.GuestEnabled = false;
    system.defaults.loginwindow.RestartDisabled = true;
    system.defaults.loginwindow.ShutDownDisabled = true;
    system.defaults.loginwindow.SleepDisabled = true;

    # Finder parameters
    system.defaults.finder._FXShowPosixPathInTitle = true;
    system.defaults.finder._FXSortFoldersFirst = true;
    system.defaults.finder.AppleShowAllFiles = true;
    system.defaults.finder.CreateDesktop = false;
    system.defaults.finder.FXDefaultSearchScope = "SCcf"; # Current folder
    system.defaults.finder.FXEnableExtensionChangeWarning = false;
    system.defaults.finder.FXPreferredViewStyle = "clmv"; # Column View
    system.defaults.finder.FXRemoveOldTrashItems = true; # Remove items in the trash after 30 days
    system.defaults.finder.NewWindowTarget = "Home";
    system.defaults.finder.QuitMenuItem = true;
    system.defaults.finder.ShowExternalHardDrivesOnDesktop = false;
    system.defaults.finder.ShowPathbar = true;
    system.defaults.finder.ShowRemovableMediaOnDesktop = false;
    system.defaults.finder.ShowStatusBar = true;

    # Dock parameters
    system.defaults.dock.autohide = true;
    system.defaults.dock.autohide-delay = 0.1;
    system.defaults.dock.autohide-time-modifier = 0.5;
    system.defaults.dock.expose-group-apps = false;
    system.defaults.dock.launchanim = false;
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
    system.defaults.dock.wvous-tl-corner = 2; # Mission Control

    # Calendar parameters
    system.defaults.iCal."first day of week" = "Monday";
    system.defaults.iCal."TimeZone support enabled" = true;

    # Activity Monitor parameters
    system.defaults.ActivityMonitor.IconType = 5;

    # Screensaver parameters
    system.defaults.screensaver.askForPassword = true;
    system.defaults.screensaver.askForPasswordDelay = 0;

    # Control center parameters
    system.defaults.controlcenter.Bluetooth = true;

    # Menu bar clock parameters
    system.defaults.menuExtraClock.Show24Hour = true;

    # Screencapture parameters
    system.defaults.screencapture.disable-shadow = true;
    system.defaults.screencapture.target = "clipboard";

    system = {
      # Used for backwards compatibility, please read the changelog before changing.
      stateVersion = 4;
    };
  };

  # Import files to setup the environment
  imports = [
    ../../profiles/ai/default.nix
    ../../profiles/cloud/default.nix
    ../../profiles/editors/default.nix
    ../../profiles/misc/default.nix
    ../../profiles/system/default.nix
    ../../profiles/terminal/default.nix
    ../../profiles/toolchains/default.nix
    ../../profiles/vcs/default.nix
    ../../profiles/virtualization/default.nix
  ];
}
