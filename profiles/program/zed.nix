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
          message_editor_min_lines = 8;
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
        excerpt_context_lines = 4;
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
        helix_mode = true;
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
              "ruff"
              "ty"
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
              completion = {
                snippets = {
                  custom = {
                    "struct impl" = {
                      prefix = "struct-impl";
                      body = [
                        "struct \${1:name} {"
                        "    $0"
                        "}"
                        ""
                        "impl $1 {"
                        "}"
                      ];
                      description = "Insert a struct with its implementation statement";
                      scope = "item";
                    };
                    "enum impl" = {
                      prefix = "enum-impl";
                      body = [
                        "enum \${1:name} {"
                        "    $0"
                        "}"
                        ""
                        "impl $1 {"
                        "}"
                      ];
                      description = "Insert a enum with its implementation statement";
                      scope = "item";
                    };
                    "enum error impl" = {
                      prefix = "enum-error-impl";
                      body = [
                        "#[derive(Debug, thiserror::Error)]"
                        "enum \${1:name} {"
                        "    #[error(\"\")]"
                        "    $0"
                        "}"
                      ];
                      description = "Insert a enum error statement";
                      scope = "item";
                    };
                    "derive" = {
                      prefix = "derive";
                      body = [
                        "#[derive($0)]"
                      ];
                      description = "Insert a derive statement";
                      scope = "item";
                    };

                    "std thread spawn" = {
                      "prefix" = [ "std-spawn" ];
                      "body" = [
                        "thread::spawn(move || {"
                        "    $0"
                        "});"
                      ];
                      "description" = "Insert a std::thread::spawn statement";
                      "requires" = [ "std::thread" ];
                      "scope" = "expr";
                    };
                    "Tokio async main" = {
                      "prefix" = [ "tokio-main" ];
                      "body" = [
                        "#[tokio::main]"
                        "async fn main() -> Result<(), Box<dyn std::error::Error>> {"
                        "    $0"
                        "}"
                      ];
                      "description" = "Insert a Tokio async main";
                      "scope" = "item";
                    };

                    "tests" = {
                      prefix = "tests";
                      body = [
                        "#[cfg(test)]"
                        "mod tests {"
                        "    use super::*;"
                        ""
                        "    $0"
                        "}"
                      ];
                      description = "Insert a test module";
                      scope = "item";
                    };
                    "unit test" = {
                      prefix = "test";
                      body = [
                        "#[test]"
                        "fn \${1:name}() {"
                        "    // Given"
                        "    $0todo!();"
                        ""
                        "    // When"
                        "    let result = todo!();"
                        ""
                        "    // Then"
                        "    assert!(result);"
                        "}"
                      ];
                      description = "Insert a test statement";
                      scope = "item";
                    };
                  };
                };
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
          active_language_button = false;
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
        title_bar = {
          show_branch_icon = true;
          show_onboarding_banner = false;
        };
        ui_font_family = "JetBrainsMono Nerd Font";
        ui_font_size = 12.5;
        use_system_path_prompts = false;
        use_system_prompts = false;
        use_system_window_tabs = true;
        vim = {
          cursor_shape = {
            normal = "block";
            insert = "bar";
            replace = "hollow";
            visual = "underline";
          };
        };
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

        # MCP servers
        "mcp-server-github"
        "mcp-server-gitlab"
        "terraform-context-server"
      ];
    };
  };
}
