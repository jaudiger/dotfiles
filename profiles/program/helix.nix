{ ... }:

{
  modules.home-manager = {
    programs.helix = {
      enable = true;
      defaultEditor = true;

      settings = {
        theme = "onelight";

        editor = {
          line-number = "relative";
          bufferline = "multiple";
          cursorline = true;
          color-modes = true;
          text-width = 120;
          popup-border = "all";

          end-of-line-diagnostics = "hint";
          inline-diagnostics = {
            cursor-line = "warning";
          };

          cursor-shape = {
            insert = "bar";
            normal = "block";
            select = "underline";
          };

          statusline = {
            left = [
              "mode"
              "spinner"
            ];
            center = [
              "version-control"
              "file-name"
            ];
            right = [
              "diagnostics"
              "selections"
              "position"
              "file-encoding"
              "file-line-ending"
              "file-type"
            ];
          };

          whitespace = {
            render = {
              space = "all";
              tab = "all";
            };
          };

          indent-guides = {
            render = true;
            character = "┆";
          };

          soft-wrap = {
            enable = true;
          };

          lsp = {
            display-messages = true;
            display-inlay-hints = true;
          };
        };
      };
    };
  };
}
