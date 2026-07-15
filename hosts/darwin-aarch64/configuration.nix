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

        shell = {
          sessionVariables = {
            # Prune Homebrew cache entries older than 7 days when `brew cleanup` runs
            HOMEBREW_CLEANUP_MAX_AGE_DAYS = "7";
            HOMEBREW_NO_ENV_HINTS = "1";
          };
        };
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

      enableZshIntegration = true;

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
        "iann0036/iamlive"
      ];

      greedyCasks = true;
    };

    programs.mas = {
      enable = true;

      cleanup = true;

      packages = {
        # To look for new apps: 'mas search MY_APP'
        myCANAL = 694580816;
        Numbers = 409203825;
        Pages = 409201541;
        Keynote = 409183694;
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

    # Power parameters
    power.restartAfterFreeze = true;

    system = {
      primaryUser = host.username;

      # Startup parameters
      startup.chime = false;

      defaults = {
        # Activity Monitor parameters
        ActivityMonitor.IconType = 5;

        # Control center parameters
        controlcenter.Bluetooth = true;

        # Custom user preferences
        CustomUserPreferences = {
          NSGlobalDomain = {
            AppleLanguages = [
              "en-FR"
              "fr-FR"
            ];
            AppleLocale = "en_FR";
          };
          "com.apple.Siri".StatusMenuVisible = false;
        };

        # Dock parameters
        dock = {
          autohide = true;
          autohide-delay = 0.1;
          autohide-time-modifier = 0.5;
          expose-group-apps = false;
          launchanim = false;
          expose-animation-duration = 0.1;
          minimize-to-application = true;
          mouse-over-hilite-stack = true;
          mru-spaces = false;
          orientation = "left";
          persistent-apps = [ ];
          persistent-others = [ "${host.homeDirectory}/Development/git-repositories" ];
          show-recents = false;
          showhidden = true;
          tilesize = 42;
          wvous-bl-corner = 11; # Launchpad
          wvous-br-corner = 1; # Disabled
          wvous-tl-corner = 2; # Mission Control
          wvous-tr-corner = 13; # Lock Screen
        };

        # Finder parameters
        finder = {
          _FXShowPosixPathInTitle = true;
          _FXSortFoldersFirst = true;
          AppleShowAllFiles = true;
          CreateDesktop = false;
          FXDefaultSearchScope = "SCcf"; # Current folder
          FXEnableExtensionChangeWarning = false;
          FXPreferredViewStyle = "clmv"; # Column View
          FXRemoveOldTrashItems = true; # Remove items in the trash after 30 days
          NewWindowTarget = "Home";
          QuitMenuItem = true;
          ShowExternalHardDrivesOnDesktop = false;
          ShowPathbar = true;
          ShowRemovableMediaOnDesktop = false;
          ShowStatusBar = true;
        };

        # Calendar parameters
        iCal = {
          "first day of week" = "Monday";
          "TimeZone support enabled" = true;
        };

        # Login parameters
        loginwindow = {
          DisableConsoleAccess = true;
          GuestEnabled = false;
          RestartDisabled = true;
          ShutDownDisabled = true;
          SleepDisabled = true;
        };

        # Menu bar clock parameters
        menuExtraClock.Show24Hour = true;

        # Global parameters
        NSGlobalDomain = {
          AppleIconAppearanceTheme = "RegularAutomatic";
          AppleInterfaceStyleSwitchesAutomatically = true;
          AppleScrollerPagingBehavior = true;
          AppleShowAllExtensions = true;
          "com.apple.springing.delay" = 0.1;
          # Keyboard
          ApplePressAndHoldEnabled = false;
          InitialKeyRepeat = 20;
          KeyRepeat = 1;
          # Text correction (disabled for coding)
          NSAutomaticCapitalizationEnabled = false;
          NSAutomaticDashSubstitutionEnabled = false;
          NSAutomaticPeriodSubstitutionEnabled = false;
          NSAutomaticQuoteSubstitutionEnabled = false;
          NSAutomaticSpellingCorrectionEnabled = false;
          # Save/Print dialogs
          NSNavPanelExpandedStateForSaveMode = true;
          NSNavPanelExpandedStateForSaveMode2 = true;
          PMPrintingExpandedStateForPrint = true;
          PMPrintingExpandedStateForPrint2 = true;
          # Status bar
          NSStatusItemSelectionPadding = 8;
          NSStatusItemSpacing = 12;
          # Misc
          NSTableViewDefaultSizeMode = 1; # Size of the finder sidebar icons
          NSTextShowsControlCharacters = true;
          NSUseAnimatedFocusRing = false;
          NSWindowShouldDragOnGesture = true;
          # iCloud
          NSDocumentSaveNewDocumentsToCloud = false;
          # Inline predictive text
          NSAutomaticInlinePredictionEnabled = false;
          # Scrollbar
          AppleShowScrollBars = "WhenScrolling";
          # Regional
          AppleICUForce24HourTime = true;
          AppleMeasurementUnits = "Centimeters";
          AppleMetricUnits = 1;
          AppleTemperatureUnit = "Celsius";
        };

        # Screencapture parameters
        screencapture = {
          disable-shadow = true;
          target = "clipboard";
        };

        # Screensaver parameters
        screensaver = {
          askForPassword = true;
          askForPasswordDelay = 0;
        };

        # Trackpad parameters
        trackpad = {
          Clicking = true;
          Dragging = true;
          TrackpadRightClick = true;
          TrackpadThreeFingerDrag = true;
          TrackpadFourFingerHorizSwipeGesture = 2; # Switch between full-screen apps
          TrackpadFourFingerPinchGesture = 2; # Pinch = Launchpad, spread = Show Desktop
        };

        # Window Manager parameters
        WindowManager = {
          EnableStandardClickToShowDesktop = false;
          StandardHideWidgets = true;
          StageManagerHideWidgets = true;
        };
      };

      # Used for backwards compatibility, please read the changelog (https://github.com/nix-darwin/nix-darwin/blob/master/CHANGELOG) before changing.
      stateVersion = 7;
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
