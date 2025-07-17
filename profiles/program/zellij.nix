{ pkgs, lib, ... }:

let
  isDarwin = pkgs.stdenv.isDarwin;
in
{
  modules.home-manager = {
    programs.zellij = {
      enable = true;

      settings = {
        default_layout = "compact";
        scroll_buffer_size = 16384;

        copy_on_select = true;
        copy_command = if isDarwin then "pbcopy" else "wl-copy";

        pane_viewport_serialization = true;

        show_release_notes = false;
        show_startup_tips = false;

        ui = {
          pane_frames = {
            hide_session_name = true;
            rounded_corners = true;
          };
        };
      };

      layouts = {
        production-clusters-view = {
          layout = {
            _children = [
              {
                pane = {
                  split_direction = "vertical";
                  _children = [
                    {
                      pane = {
                        command = "alaska-k9s";
                        _children = [
                          {
                            args = [
                              "-e"
                              "production-eu"
                            ];
                          }
                        ];
                      };
                    }
                    {
                      pane = {
                        command = "alaska-k9s";
                        _children = [
                          {
                            args = [
                              "-e"
                              "production-anz"
                            ];
                          }
                        ];
                      };
                    }
                  ];
                };
              }
              {
                pane = {
                  command = "alaska-k9s";
                  _children = [
                    {
                      args = [
                        "-e"
                        "monitoring"
                      ];
                    }
                  ];
                };
              }
            ];
          };
        };
      };
    };

    home = {
      packages = with pkgs; lib.optionals (!isDarwin) [ wl-copy ];
    };
  };
}
