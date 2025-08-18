{ ... }:

{
  modules.home-manager = {
    programs.zed-editor = {
      enable = true;

      # Only manage the user settings, keymaps, and extensions
      package = null;

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
          thread_summary_model = {
            model = "devstral-small-latest";
            provider = "mistral";
          };
          use_modifier_to_send = true;
        };
        agent_font_size = 12.5;
        auto_install_extensions = {
          html = false;
        };
        autosave = {
          after_delay = {
            milliseconds = 1000;
          };
        };
        buffer_font_family = "JetBrainsMono Nerd Font";
        buffer_font_size = 12.5;
        collaboration_panel = {
          dock = "right";
        };
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
        "experimental.theme_overrides" = {
          "background.appearance" = "blurred";
        };
        features = {
          edit_prediction_provider = "zed";
        };
        file_scan_exclusions = [
          "**/.angular"
          "**/.devenv"
          "**/.git"
          "**/.gradle"
          "**/.idea"
          "**/.jj"
          "**/.venv"
          "**/build"
          "**/coverage"
          "**/dist"
          "**/output"
          "**/node_modules"
          "**/target"
          "**/__pycache__"
        ];
        file_types = {
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
        languages = {
          Python = {
            formatter = {
              language_server = {
                name = "ruff";
              };
            };
            language_servers = [
              "pyright"
              "ruff"
            ];
          };
        };
        line_indicator_format = "short";
        lsp = {
          jdtls = {
            initialization_options = {
              settings = {
                java = {
                  configuration = {
                    updateBuildConfiguration = "interactive";
                  };
                  import = {
                    gradle = {
                      enabled = true;
                    };
                    maven = {
                      enabled = true;
                    };
                  };
                  jdt = {
                    ls = {
                      lombokSupport = {
                        enabled = true;
                      };
                    };
                  };
                  autobuild = {
                    enabled = true;
                  };
                  implementationsCodeLens = {
                    enabled = true;
                  };
                  referencesCodeLens = {
                    enabled = true;
                  };
                  signatureHelp = {
                    enabled = true;
                  };
                };
              };
            };
          };
          "rust-analyzer" = {
            initialization_options = {
              cargo = {
                allTargets = true;
                features = "all";
              };
              check = {
                allTargets = true;
                command = "clippy";
              };
              imports = {
                granularity = {
                  group = "item";
                };
              };
              inlayHints = {
                closingBraceHints = {
                  enable = false;
                };
                closureStyle = "rust_analyzer";
                discriminantHints = {
                  enable = "fieldless";
                };
                expressionAdjustmentHints = {
                  enable = "never";
                };
                implicitDrops = {
                  enable = true;
                };
                lifetimeElisionHints = {
                  enable = "skip_trivial";
                };
                parameterHints = {
                  enable = true;
                };
                typeHints = {
                  enable = true;
                };
              };
              lens = {
                references = {
                  adt = {
                    enabled = true;
                  };
                  enumVariant = {
                    enable = true;
                  };
                  method = {
                    enabled = true;
                  };
                  trait = {
                    enabled = true;
                  };
                };
              };
              references = {
                excludeImports = true;
                excludeTests = true;
              };
              rust = {
                analyzerTargetDir = true;
              };
              testExplorer = true;
            };
          };
          "yaml-language-server" = {
            settings = {
              yaml = {
                completion = true;
                format = {
                  enable = true;
                };
                hover = true;
                schemaStore = {
                  enable = true;
                };
                schemas = {
                  kubernetes = "**.yaml";
                };
                validate = true;
              };
            };
          };
        };
        outline_panel = {
          dock = "right";
        };
        preferred_line_length = 120;
        project_panel = {
          dock = "right";
        };
        relative_line_numbers = true;
        scroll_beyond_last_line = "off";
        scrollbar = {
          cursors = false;
          diagnostics = "warning";
        };
        show_call_status_icon = false;
        show_whitespaces = "boundary";
        soft_wrap = "editor_width";
        status_bar = {
          show_active_language_button = false;
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
          keep_selection_on_copy = true;
        };
        ui_font_family = "JetBrainsMono Nerd Font";
        ui_font_size = 12.5;
        use_system_path_prompts = false;
        use_system_prompts = false;
        vim = {
          cursor_shape = {
            normal = "block";
            insert = "bar";
            replace = "hollow";
            visual = "underline";
          };
        };
        vim_mode = true;
      };

      userKeymaps = [
        {
          context = "Workspace";
          bindings = { };
        }
        {
          context = "Editor";
          bindings = { };
        }
      ];

      extensions = [
        "basher"
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
        "ruff"
        "terraform"
        "toml"
        "xml"
        "zig"

        # MCP servers
        "mcp-server-github"
        "mcp-server-gitlab"
      ];
    };
  };
}
