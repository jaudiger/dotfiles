{ ... }:

{
  modules.home-manager =
    { pkgs, ... }:
    {
      programs.nixvim = {
        enable = true;
        defaultEditor = true;

        extraPackages = with pkgs; [
          fd
          ripgrep
        ];

        colorschemes = {
          one = {
            enable = true;
          };
        };

        globals = {
          mapleader = " ";
        };

        globalOpts = {
          mouse = "a";
          clipboard = "unnamedplus";
        };

        opts = {
          colorcolumn = "120";
          cursorline = true;
          expandtab = true;
          guicursor = "n-v-c:block,i-ci-ve:ver25,r-cr-o:hor20";
          ignorecase = true;
          linebreak = true;
          list = true;
          listchars = "space:·,tab:→ ,trail:~,extends:>,precedes:<";
          number = true;
          relativenumber = true;
          scrolloff = 8;
          shiftwidth = 4;
          signcolumn = "yes";
          smartcase = true;
          smartindent = true;
          splitbelow = true;
          splitright = true;
          tabstop = 4;
          textwidth = 120;
          timeoutlen = 500;
          updatetime = 250;
        };

        plugins = {
          lualine = {
            enable = true;
            settings = {
              options = {
                theme = "onelight";
                component_separators = {
                  left = "";
                  right = "";
                };
                section_separators = {
                  left = "";
                  right = "";
                };
              };
              sections = {
                lualine_a = [ "mode" ];
                lualine_b = [ "branch" ];
                lualine_c = [ "filename" ];
                lualine_x = [ "diagnostics" ];
                lualine_y = [
                  "progress"
                  "location"
                ];
                lualine_z = [ "filetype" ];
              };
            };
          };

          bufferline = {
            enable = true;
            settings.options = {
              mode = "buffers";
              show_buffer_close_icons = true;
              show_close_icon = false;
              diagnostics = "nvim_lsp";
            };
          };

          indent-blankline = {
            enable = true;
            settings = {
              indent.char = "┆";
              scope.enabled = true;
            };
          };

          treesitter = {
            enable = true;
            settings = {
              highlight.enable = true;
              indent.enable = true;
            };
          };

          treesitter-context = {
            enable = true;
            settings = {
              max_lines = 3;
              min_window_height = 15;
            };
          };

          rainbow-delimiters = {
            enable = true;
          };

          lsp = {
            enable = true;
            inlayHints = true;
          };

          blink-cmp = {
            enable = true;
            settings = {
              keymap.preset = "default";
              sources.default = [
                "lsp"
                "path"
                "snippets"
                "buffer"
              ];
            };
          };

          snacks = {
            enable = true;
            settings = {
              explorer = {
                enabled = true;
              };
              picker = {
                enabled = true;
                sources = {
                  explorer = {
                    layout = {
                      layout = {
                        position = "right";
                      };
                    };
                  };
                };
              };
            };
          };

          mini = {
            enable = true;
            mockDevIcons = true;
            modules = {
              icons = { };
              pairs = { };
              surround = { };
            };
          };

          gitsigns = {
            enable = true;
            settings = {
              signs = {
                add.text = "│";
                change.text = "│";
                delete.text = "_";
                topdelete.text = "‾";
                changedelete.text = "~";
              };
            };
          };

          conform-nvim = {
            enable = true;
            settings = {
              format_on_save = {
                timeout_ms = 500;
                lsp_fallback = true;
              };
            };
          };

          lint.enable = true;
        };

        keymaps = [
          {
            mode = "n";
            key = "<leader>e";
            action = "<cmd>lua Snacks.explorer()<CR>";
            options.desc = "Toggle file explorer";
          }
          {
            mode = "n";
            key = "<leader>ff";
            action = "<cmd>lua Snacks.picker.files()<CR>";
            options.desc = "Find files";
          }
          {
            mode = "n";
            key = "<leader>fg";
            action = "<cmd>lua Snacks.picker.grep()<CR>";
            options.desc = "Live grep";
          }
          {
            mode = "n";
            key = "<leader>fb";
            action = "<cmd>lua Snacks.picker.buffers()<CR>";
            options.desc = "Find buffers";
          }
          {
            mode = "n";
            key = "<leader>fh";
            action = "<cmd>lua Snacks.picker.help()<CR>";
            options.desc = "Help tags";
          }
          {
            mode = "n";
            key = "<S-l>";
            action = "<cmd>bnext<CR>";
            options.desc = "Next buffer";
          }
          {
            mode = "n";
            key = "<S-h>";
            action = "<cmd>bprevious<CR>";
            options.desc = "Previous buffer";
          }
          {
            mode = "n";
            key = "<C-h>";
            action = "<C-w>h";
            options.desc = "Move to left window";
          }
          {
            mode = "n";
            key = "<C-j>";
            action = "<C-w>j";
            options.desc = "Move to lower window";
          }
          {
            mode = "n";
            key = "<C-k>";
            action = "<C-w>k";
            options.desc = "Move to upper window";
          }
          {
            mode = "n";
            key = "<C-l>";
            action = "<C-w>l";
            options.desc = "Move to right window";
          }
          {
            mode = "n";
            key = "<Esc>";
            action = "<cmd>nohlsearch<CR>";
            options.desc = "Clear search highlight";
          }
        ];

        extraConfigLua = ''
          vim.o.winborder = 'rounded'

          vim.diagnostic.config({
            virtual_text = {
              prefix = '●',
              source = 'if_many',
            },
            signs = {
              text = {
                [vim.diagnostic.severity.ERROR] = ' ',
                [vim.diagnostic.severity.WARN] = ' ',
                [vim.diagnostic.severity.HINT] = '󰌵 ',
                [vim.diagnostic.severity.INFO] = ' ',
              },
            },
            underline = true,
            update_in_insert = false,
            severity_sort = true,
            float = {
              source = 'if_many',
            },
          })
        '';
      };
    };
}
