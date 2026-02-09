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
    casks = [ "zed@preview" ];
  };

  modules.home-manager = {
    programs.zed-editor = {
      enable = true;

      package = lib.mkIf isDarwin null;

      userSettings = {
        agent = {
          always_allow_tool_actions = true;
          commit_message_model = {
            model = "devstral-small-latest";
            provider = "mistral";
          };
          default_model = {
            model = "devstral-medium-latest";
            provider = "mistral";
          };
          default_profile = "write";
          enable_feedback = false;
          expand_edit_card = false;
          expand_terminal_card = false;
          inline_assistant_model = {
            model = "devstral-medium-latest";
            provider = "mistral";
          };
          message_editor_min_lines = 8;
          play_sound_when_agent_done = true;
          show_turn_stats = true;
          thread_summary_model = {
            model = "devstral-small-latest";
            provider = "mistral";
          };
          use_modifier_to_send = true;
        };
        agent_buffer_font_size = 11.5;
        agent_servers = {
          claude = {
            ignore_system_version = false;
          };
        };
        auto_install_extensions = {
          html = false;
        };
        autosave = {
          after_delay = {
            milliseconds = 1000;
          };
        };
        auto_update = false;
        auto_signature_help = true;
        buffer_font_family = "JetBrainsMono Nerd Font";
        buffer_font_size = 12.5;
        collaboration_panel = {
          dock = "right";
        };
        colorize_brackets = true;
        completion_menu_scrollbar = "auto";
        confirm_quit = true;
        current_line_highlight = "line";
        diagnostics = {
          inline = {
            enabled = true;
          };
        };
        edit_predictions = {
          provider = "zed";
          enabled_in_text_threads = true;
          mode = "subtle";
        };
        excerpt_context_lines = 4;
        "experimental.theme_overrides" = {
          "background.appearance" = "blurred";
        };
        file_scan_exclusions = map (path: "**/${path}") config.modules.host.ignores;
        file_types = {
          Dockerfile = [
            "Dockerfile"
            "Dockerfile.*"
          ];
          JSON = [
            "brioche.lock"
          ];
          TypeScript = [
            "*.bri"
          ];
        };
        git = {
          inline_blame = {
            min_column = 120;
          };
        };
        git_panel = {
          dock = "right";
          tree_view = true;
        };
        indent_guides = {
          active_line_width = 2;
          coloring = "fixed";
        };
        inlay_hints = {
          enabled = false;
          show_background = true;
          toggle_on_modifiers_press = {
            control = true;
          };
        };
        line_indicator_format = "short";
        notification_panel = {
          button = false;
        };
        outline_panel = {
          dock = "right";
        };
        preferred_line_length = 120;
        project_panel = {
          dock = "right";
        };
        read_only_files = [
          "**/Cargo.lock"
          "**/composer.lock"
          "**/flake.lock"
          "**/Gemfile.lock"
          "**/go.sum"
          "**/gradle.lockfile"
          "**/package-lock.json"
          "**/pnpm-lock.yaml"
          "**/poetry.lock"
          "**/yarn.lock"
        ];
        relative_line_numbers = "enabled";
        scroll_beyond_last_line = "off";
        scrollbar = {
          cursors = false;
          diagnostics = "warning";
        };
        search = {
          button = false;
          center_on_match = true;
          include_ignored = true;
        };
        show_call_status_icon = false;
        show_whitespaces = "boundary";
        soft_wrap = "editor_width";
        status_bar = {
          active_language_button = false;
        };
        sticky_scroll = {
          enabled = true;
        };
        tab_bar = {
          show = false;
          show_nav_history_buttons = false;
        };
        tabs = {
          close_position = "left";
          file_icons = true;
          git_status = true;
        };
        terminal = {
          blinking = "on";
          copy_on_select = true;
          font_size = 11.5;
        };
        theme = {
          dark = "One Dark";
          light = "One Light";
          mode = "system";
        };
        title_bar = {
          show_branch_icon = true;
          show_onboarding_banner = false;
        };
        ui_font_family = "JetBrainsMono Nerd Font";
        ui_font_size = 12.5;
        use_smartcase_search = true;
        use_system_path_prompts = false;
        use_system_prompts = false;
        use_system_window_tabs = true;
        vertical_scroll_margin = 4;
        vim_mode = true;
        vim = {
          cursor_shape = {
            normal = "block";
            insert = "bar";
            replace = "hollow";
            visual = "underline";
          };
          use_smartcase_find = true;
          toggle_relative_line_numbers = true;
        };
      };

      userKeymaps = [
        # Buffers
        {
          context = "Editor && VimControl && !VimWaiting && !menu";
          bindings = {
            "] b" = "pane::ActivateNextItem";
            "[ b" = "pane::ActivatePreviousItem";
          };
        }

        # Code
        {
          context = "Editor && VimControl && !VimWaiting && !menu";
          bindings = {
            "g r n" = "editor::Rename";
            "g r r" = "editor::FindAllReferences";
            "g r i" = "editor::GoToImplementation";
            "g r t" = "editor::GoToTypeDefinition";
            "g r a" = "editor::ToggleCodeActions";
            "g O" = "outline::Toggle";
          };
        }

        # Diagnostic
        {
          context = "Editor && (vim_mode == normal || vim_mode == visual) && !VimWaiting && !menu && !GitPanel";
          bindings = {
            "space x x" = "diagnostics::Deploy";
            "space x X" = "diagnostics::DeployCurrentFile";
            "space x s" = "outline::Toggle";
          };
        }

        # Explorer
        {
          context = "Editor && (vim_mode == normal || vim_mode == visual) && !VimWaiting && !menu && !GitPanel";
          bindings = {
            "space e" = "project_panel::ToggleFocus";
          };
        }

        # Find
        {
          context = "Editor && (vim_mode == normal || vim_mode == visual) && !VimWaiting && !menu && !GitPanel";
          bindings = {
            "space f f" = "file_finder::Toggle";
            "space f b" = "tab_switcher::Toggle";
            "space f g" = "pane::DeploySearch";
            "space f h" = "zed::OpenKeymap";
            "space f r" = "projects::OpenRecent";
            "space f s" = "outline::Toggle";
          };
        }

        # Git
        {
          context = "Editor && VimControl && !VimWaiting && !menu";
          bindings = {
            "] g" = "editor::GoToHunk";
            "[ g" = "editor::GoToPreviousHunk";
          };
        }
        {
          context = "Editor && (vim_mode == normal || vim_mode == visual) && !VimWaiting && !menu && !GitPanel";
          bindings = {
            "space g g" = "git_panel::ToggleFocus";
            "space g B" = "git::Blame";
            "space g p" = "editor::ToggleSelectedDiffHunks";
            "space g R" = "git::Restore";
            "space g S" = "git::StageAndNext";
            "space g U" = "git::UnstageAndNext";
          };
        }
      ];

      extensions = [
        "basher"
        "cspell"
        "dockerfile"
        "git-firefly"
        "golangci-lint"
        "html"
        "java"
        "latex"
        "log"
        "make"
        "neocmake"
        "nix"
        "nu"
        "terraform"
        "toml"
        "xml"
        "zig"
      ];
    };
  };
}
