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
          onedark = {
            enable = true;
            settings = {
              style = "dark";
            };
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
          undofile = true;
          updatetime = 250;

          # nvim-ufo fold settings
          foldcolumn = "1";
          foldlevel = 99;
          foldlevelstart = 99;
          foldenable = true;
        };

        performance = {
          byteCompileLua = {
            enable = true;
            configs = true;
            luaLib = true;
            nvimRuntime = true;
            plugins = true;
          };
        };

        plugins = {
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

          conform-nvim = {
            enable = true;
            settings = {
              format_on_save = {
                timeout_ms = 500;
                lsp_fallback = true;
              };
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

          indent-blankline = {
            enable = true;
            settings = {
              indent = {
                char = "┆";
              };
            };
          };

          lint.enable = true;

          lsp = {
            enable = true;
            inlayHints = true;
          };

          lualine = {
            enable = true;
            settings = {
              options = {
                theme = "onedark";
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

          mini = {
            enable = true;
            mockDevIcons = true;
            modules = {
              icons = { };
              pairs = { };
              surround = { };
            };
          };

          nvim-ufo = {
            enable = true;
            settings = {
              provider_selector = ''
                function(bufnr, filetype, buftype)
                  return { 'treesitter', 'indent' }
                end
              '';
            };
          };

          rainbow-delimiters = {
            enable = true;
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

          todo-comments = {
            enable = true;
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

          trouble = {
            enable = true;
          };

          undotree = {
            enable = true;
          };
        };

        keymaps = [
          # Explorer
          {
            mode = "n";
            key = "<leader>e";
            action = "<cmd>lua Snacks.explorer()<CR>";
            options.desc = "File explorer";
          }

          # Find
          {
            mode = "n";
            key = "<leader>ff";
            action = "<cmd>lua Snacks.picker.files()<CR>";
            options.desc = "Files";
          }
          {
            mode = "n";
            key = "<leader>fg";
            action = "<cmd>lua Snacks.picker.grep()<CR>";
            options.desc = "Grep";
          }
          {
            mode = "n";
            key = "<leader>fb";
            action = "<cmd>lua Snacks.picker.buffers()<CR>";
            options.desc = "Buffers";
          }
          {
            mode = "n";
            key = "<leader>fh";
            action = "<cmd>lua Snacks.picker.help()<CR>";
            options.desc = "Help";
          }
          {
            mode = "n";
            key = "<leader>fr";
            action = "<cmd>lua Snacks.picker.recent()<CR>";
            options.desc = "Recent";
          }
          {
            mode = "n";
            key = "<leader>fs";
            action = "<cmd>lua Snacks.picker.lsp_symbols()<CR>";
            options.desc = "Symbols";
          }
          {
            mode = "n";
            key = "<leader>ft";
            action = "<cmd>TodoTrouble<CR>";
            options.desc = "TODOs";
          }

          # Buffers
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

          # Windows
          {
            mode = "n";
            key = "<C-h>";
            action = "<C-w>h";
            options.desc = "Left window";
          }
          {
            mode = "n";
            key = "<C-j>";
            action = "<C-w>j";
            options.desc = "Lower window";
          }
          {
            mode = "n";
            key = "<C-k>";
            action = "<C-w>k";
            options.desc = "Upper window";
          }
          {
            mode = "n";
            key = "<C-l>";
            action = "<C-w>l";
            options.desc = "Right window";
          }

          # Misc
          {
            mode = "n";
            key = "<Esc>";
            action = "<cmd>nohlsearch<CR>";
            options.desc = "Clear highlight";
          }
          {
            mode = "n";
            key = "<leader>u";
            action = "<cmd>UndotreeToggle<CR>";
            options.desc = "Undo tree";
          }

          # Trouble
          {
            mode = "n";
            key = "<leader>xx";
            action = "<cmd>Trouble diagnostics toggle<CR>";
            options.desc = "Diagnostics";
          }
          {
            mode = "n";
            key = "<leader>xX";
            action = "<cmd>Trouble diagnostics toggle filter.buf=0<CR>";
            options.desc = "Buffer diagnostics";
          }
          {
            mode = "n";
            key = "<leader>xs";
            action = "<cmd>Trouble symbols toggle<CR>";
            options.desc = "Symbols";
          }
          {
            mode = "n";
            key = "<leader>xq";
            action = "<cmd>Trouble qflist toggle<CR>";
            options.desc = "Quickfix";
          }

          # TODO navigation
          {
            mode = "n";
            key = "]t";
            action.__raw = "function() require('todo-comments').jump_next() end";
            options.desc = "Next TODO";
          }
          {
            mode = "n";
            key = "[t";
            action.__raw = "function() require('todo-comments').jump_prev() end";
            options.desc = "Prev TODO";
          }

          # Folding (nvim-ufo)
          {
            mode = "n";
            key = "zR";
            action.__raw = "function() require('ufo').openAllFolds() end";
            options.desc = "Open all folds";
          }
          {
            mode = "n";
            key = "zM";
            action.__raw = "function() require('ufo').closeAllFolds() end";
            options.desc = "Close all folds";
          }
          {
            mode = "n";
            key = "zK";
            action.__raw = "function() require('ufo').peekFoldedLinesUnderCursor() end";
            options.desc = "Peek fold";
          }
        ];

        extraConfigLua = ''
          vim.o.winborder = 'rounded'
          vim.o.fillchars = 'eob: ,fold: ,foldopen:▾,foldsep:│,foldclose:▸'

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
