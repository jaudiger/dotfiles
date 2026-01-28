{ pkgs, ... }:

let
  # Shared LSP configuration for ruff
  ruffConfig = {
    settings = {
      lineLength = 120;
    };
  };
in
{
  nixpkgs.overlays = [
    (_final: prev: {
      pythonPackagesExtensions = prev.pythonPackagesExtensions ++ [
        (python-final: _python-prev: {
          robotframework-robocop = python-final.callPackage ../../pkgs/robotframework-robocop.nix { };
        })
      ];
    })
  ];

  modules = {
    home-manager = {
      home = {
        packages = with pkgs; [
          python313
          python313Packages.pip
          python313Packages.robotframework-robocop

          virtualenv
          uv

          # Static analyzer
          ruff
        ];
      };

      programs.poetry = {
        enable = true;
        settings = {
          virtualenvs = {
            create = true;
            in-project = true;
          };
        };
      };

      programs.ty = {
        enable = true;
      };

      # Neovim configuration
      programs.nixvim = {
        plugins.lsp.servers = {
          ruff = {
            enable = true;
            settings = ruffConfig;
          };
        };

        extraConfigLua = ''
          vim.lsp.config('ty', {
            cmd = { 'ty', 'server' },
            filetypes = { 'python' },
            root_markers = { 'pyproject.toml', 'setup.py', 'setup.cfg', '.git' },
          })
          vim.lsp.enable('ty')
        '';
      };

      # Zed configuration
      programs.zed-editor.userSettings = {
        languages = {
          Python = {
            formatter = [
              { code_action = "source.organizeImports.ruff"; }
              {
                language_server = {
                  name = "ruff";
                };
              }
            ];
            language_servers = [
              "ty"
              "!basedpyright"
              "..."
            ];
          };
        };
        lsp = {
          ruff = {
            initialization_options = ruffConfig;
          };
        };
      };
    };

    host.shell.aliases = {
      python-debug = "python -m ptvsd --host localhost --wait";
      python-fmt = "ruff format";
      ruff-analyzer = "ruff --line-length 120 --select E,F,W,C90,I,N,UP,YTT,ANN,S,BLE,FBT,B,A,COM,C4,DTZ,T10,EM,EXE,ISC,ICN,G,LOG,PIE,T20,PT,Q,RET,SIM,TID,ARG,PTH,ERA,PD,PGH,PL,TRY,PERF,FURB,RUF --ignore A003,N818,S104,PIE804,B008";
    };
  };
}
