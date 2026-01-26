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
          expand_edit_card = false;
          expand_terminal_card = false;
          inline_assistant_model = {
            model = "devstral-medium-latest";
            provider = "mistral";
          };
          message_editor_min_lines = 8;
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
          codex = {
            ignore_system_version = false;
          };
          gemini = {
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
          enabled_in_text_threads = true;
          mode = "subtle";
        };
        excerpt_context_lines = 4;
        "experimental.theme_overrides" = {
          "background.appearance" = "blurred";
        };
        features = {
          edit_prediction_provider = "zed";
        };
        file_scan_exclusions = [
          "**/.angular"
          "**/.cache"
          "**/.devenv"
          "**/.git"
          "**/.gradle"
          "**/.idea"
          "**/.jj"
          "**/.next"
          "**/.pnpm-store"
          "**/.swc"
          "**/.venv"
          "**/build"
          "**/coverage"
          "**/dist"
          "**/node_modules"
          "**/output"
          "**/target"
          "**/__pycache__"
        ];
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

      userTasks = [
        {
          label = "Launch Claude Code";
          command = "claude";
        }
      ];

      userKeymaps = [
        {
          bindings = { };
          context = "Editor";
        }
        {
          bindings = {
            "cmd-N" = [
              "workspace::NewTerminal"
              { "local" = true; }
            ];
          };
          context = "Terminal";
        }
        {
          bindings = {
            "g c c" = [
              "task::Spawn"
              {
                "task_name" = "Launch Claude Code";
                "reveal_target" = "dock";
              }
            ];
          };
          context = "Workspace";
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
        "ruby"
        "terraform"
        "toml"
        "xml"
        "zig"
      ];
    };
  };
}
