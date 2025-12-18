{ pkgs, ... }:

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
          robotframework-tidy

          virtualenv
          uv

          # Static analyzer
          ruff
        ];
      };

      programs.poetry = {
        enable = true;
        settings = {
          virtualenvs.create = true;
          virtualenvs.in-project = true;
        };
      };

      programs.ty = {
        enable = true;
      };

      # Helix configuration
      programs.helix.languages = {
        language-server = {
          ty = {
            command = "ty";
            args = [ "server" ];
          };
          ruff = {
            command = "ruff";
            args = [ "server" ];
          };
        };

        language = [
          {
            name = "python";
            scope = "source.python";
            injection-regex = "python";
            file-types = [
              "py"
              "pyi"
              "py3"
              "pyw"
              "ptl"
              ".pythonstartup"
              ".pythonrc"
              "SConstruct"
            ];
            shebangs = [ "python" ];
            roots = [
              "setup.py"
              "setup.cfg"
              "pyproject.toml"
            ];
            comment-token = "#";
            language-servers = [
              "ruff"
              "ty"
            ];
            indent = {
              tab-width = 4;
              unit = "    ";
            };
          }
        ];
      };
    };

    host.shell.aliases = {
      python-debug = "python -m ptvsd --host localhost --wait";
      python-fmt = "ruff format";
      ruff-analyzer = "ruff --line-length 120 --select E,F,W,C90,N,UP,YTT,ANN,S,BLE,FBT,B,A,COM,C4,DTZ,T10,EM,EXE,ISC,ICN,PIE,T20,PT,Q,RET,SIM,TID,ARG,PTH,ERA,PD,PGH,PL,TRY,RUF --ignore A003,ANN101,N818,S104,PIE804,B008";
    };
  };
}
