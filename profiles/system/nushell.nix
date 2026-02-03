{ lib, ... }:

let
  mkNushellInline = expr: lib.setType "nushell-inline" { inherit expr; };
in
{
  modules.home-manager = {
    # Add the autoload folder
    home.file."nushellAutoload" = {
      source = ../../config/nushell/autoload;
      target = ".config/nushell/autoload";
    };

    programs.nushell = {
      enable = true;

      # Only overridden values should be set, to find them:
      # let defaults = nu -n -c "$env.config = {}; $env.config | reject color_config keybindings menus | to nuon" | from nuon | transpose key default
      # let current = $env.config | reject color_config keybindings menus | transpose key current
      # $current | merge $defaults | where ($it.current != $it.default)
      settings = {
        completions = {
          algorithm = "fuzzy";
          case_sensitive = true;
          external = {
            completer = mkNushellInline "{|spans: list<string>|
                ^carapace $spans.0 nushell ...$spans
                  | from json
                  | if ($in | default [] | where (value =~ '^-.*ERR$') | is-empty) { $in } else { null }
            }";
          };
        };

        datetime_format = {
          normal = "%a, %d %b %Y %H:%M:%S %z";
          table = "%F %H:%M:%S";
        };

        display_errors = {
          exit_code = true;
        };

        edit_mode = "vi";

        error_style = "short";

        history = {
          file_format = "sqlite";
        };

        rm = {
          always_trash = true;
        };

        show_banner = false;

        table = {
          missing_value_symbol = " ∅ ";
          mode = "compact";
          padding = {
            left = 0;
            right = 0;
          };
          footer_inheritance = true;
          header_on_separator = true;
        };
      };

      configFile.text = ''
        # General imports
        use work-scripts
      '';

      environmentVariables = {
        # Prompt configuration
        PROMPT_INDICATOR = "";
        PROMPT_INDICATOR_VI_INSERT = "";
        PROMPT_INDICATOR_VI_NORMAL = "";
      };

      envFile.text = ''
        $env.NU_LIB_DIRS = [
            ($nu.home-dir | path join "Development" "git-repositories" "jaudiger" "personal-scripts")
            ($nu.home-dir | path join "Development")
        ]
      '';
    };
  };
}
