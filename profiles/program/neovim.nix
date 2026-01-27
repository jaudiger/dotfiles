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
              sources = {
                default = [
                  "lsp"
                  "path"
                  "snippets"
                  "buffer"
                ];
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

          diffview = {
            enable = true;
          };

          flash = {
            enable = true;
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
              on_attach = ''
                function(bufnr)
                  local gs = require('gitsigns')
                  local function map(mode, l, r, opts)
                    opts = opts or {}
                    opts.buffer = bufnr
                    vim.keymap.set(mode, l, r, opts)
                  end
                  map('n', ']g', function() gs.nav_hunk('next') end, { desc = 'Next git hunk' })
                  map('n', '[g', function() gs.nav_hunk('prev') end, { desc = 'Previous git hunk' })
                  map('n', '<leader>gB', function() gs.blame_line({ full = true }) end, { desc = 'Blame line (full)' })
                  map('n', '<leader>gp', gs.preview_hunk, { desc = 'Preview hunk' })
                  map('n', '<leader>gR', gs.reset_hunk, { desc = 'Reset hunk' })
                  map('n', '<leader>gS', gs.stage_hunk, { desc = 'Stage hunk' })
                  map('n', '<leader>gU', gs.undo_stage_hunk, { desc = 'Undo stage hunk' })
                end
              '';
            };
          };

          harpoon = {
            enable = true;
            settings.settings = {
              save_on_toggle = true;
              sync_on_ui_close = true;
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

          lint = {
            enable = true;
          };

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

          neogit = {
            enable = true;
            settings = {
              integrations = {
                diffview = true;
              };
              kind = "split";
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

          which-key = {
            enable = true;
            settings = {
              delay = 300;
              spec = [
                {
                  __unkeyed-1 = "<leader>b";
                  group = "Buffer";
                }
                {
                  __unkeyed-1 = "<leader>c";
                  group = "Code";
                }
                {
                  __unkeyed-1 = "<leader>f";
                  group = "Find";
                }
                {
                  __unkeyed-1 = "<leader>g";
                  group = "Git";
                }
                {
                  __unkeyed-1 = "<leader>h";
                  group = "Harpoon";
                }
                {
                  __unkeyed-1 = "<leader>w";
                  group = "Window";
                }
                {
                  __unkeyed-1 = "<leader>x";
                  group = "Trouble";
                }
              ];
            };
          };
        };

        keymaps = [
          # Buffers
          {
            mode = "n";
            key = "]b";
            action = "<cmd>bnext<CR>";
            options.desc = "Next buffer";
          }
          {
            mode = "n";
            key = "[b";
            action = "<cmd>bprevious<CR>";
            options.desc = "Previous buffer";
          }
          {
            mode = "n";
            key = "<leader>bd";
            action = "<cmd>bdelete<CR>";
            options.desc = "Delete buffer";
          }

          # Diagnostic
          {
            mode = "n";
            key = "]d";
            action.__raw = "function() vim.diagnostic.jump({ count = 1 }) end";
            options.desc = "Next diagnostic";
          }
          {
            mode = "n";
            key = "[d";
            action.__raw = "function() vim.diagnostic.jump({ count = -1 }) end";
            options.desc = "Previous diagnostic";
          }
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

          # Folding
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

          # Git
          {
            mode = "n";
            key = "<leader>gg";
            action = "<cmd>Neogit<CR>";
            options.desc = "Neogit";
          }
          {
            mode = "n";
            key = "<leader>gc";
            action = "<cmd>Neogit commit<CR>";
            options.desc = "Commit";
          }
          {
            mode = "n";
            key = "<leader>gd";
            action = "<cmd>DiffviewOpen<CR>";
            options.desc = "Diff view";
          }
          {
            mode = "n";
            key = "<leader>gh";
            action = "<cmd>DiffviewFileHistory %<CR>";
            options.desc = "File history";
          }
          {
            mode = "n";
            key = "<leader>gH";
            action = "<cmd>DiffviewFileHistory<CR>";
            options.desc = "Branch history";
          }
          {
            mode = "n";
            key = "<leader>gq";
            action = "<cmd>DiffviewClose<CR>";
            options.desc = "Close diff";
          }

          # Harpoon
          {
            mode = "n";
            key = "<leader>ha";
            action.__raw = "function() require('harpoon'):list():add() end";
            options.desc = "Add file";
          }
          {
            mode = "n";
            key = "<leader>hh";
            action.__raw = "function() require('harpoon').ui:toggle_quick_menu(require('harpoon'):list()) end";
            options.desc = "Menu";
          }
          {
            mode = "n";
            key = "<leader>1";
            action.__raw = "function() require('harpoon'):list():select(1) end";
            options.desc = "Harpoon 1";
          }
          {
            mode = "n";
            key = "<leader>2";
            action.__raw = "function() require('harpoon'):list():select(2) end";
            options.desc = "Harpoon 2";
          }
          {
            mode = "n";
            key = "<leader>3";
            action.__raw = "function() require('harpoon'):list():select(3) end";
            options.desc = "Harpoon 3";
          }
          {
            mode = "n";
            key = "<leader>4";
            action.__raw = "function() require('harpoon'):list():select(4) end";
            options.desc = "Harpoon 4";
          }
          {
            mode = "n";
            key = "<leader>hn";
            action.__raw = "function() require('harpoon'):list():next() end";
            options.desc = "Next";
          }
          {
            mode = "n";
            key = "<leader>hp";
            action.__raw = "function() require('harpoon'):list():prev() end";
            options.desc = "Prev";
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

          # TODO comments
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
            options.desc = "Previous TODO";
          }

          # Windows
          {
            mode = "n";
            key = "<leader>wh";
            action = "<C-w>h";
            options.desc = "Window left";
          }
          {
            mode = "n";
            key = "<leader>wj";
            action = "<C-w>j";
            options.desc = "Window down";
          }
          {
            mode = "n";
            key = "<leader>wk";
            action = "<C-w>k";
            options.desc = "Window up";
          }
          {
            mode = "n";
            key = "<leader>wl";
            action = "<C-w>l";
            options.desc = "Window right";
          }
          {
            mode = "n";
            key = "<leader>ws";
            action = "<cmd>split<CR>";
            options.desc = "Split horizontal";
          }
          {
            mode = "n";
            key = "<leader>wv";
            action = "<cmd>vsplit<CR>";
            options.desc = "Split vertical";
          }
          {
            mode = "n";
            key = "<leader>wd";
            action = "<cmd>close<CR>";
            options.desc = "Close window";
          }
        ];

        extraConfigLua = ''
          -- UI options
          vim.o.winborder = 'rounded'
          vim.o.fillchars = 'eob: ,fold: ,foldopen:▾,foldsep:│,foldclose:▸'
          vim.opt.shortmess:append("I")

          -- Diagnostic configuration
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
          })

          -- LSP keymaps
          vim.api.nvim_create_autocmd('LspAttach', {
            group = vim.api.nvim_create_augroup('UserLspConfig', {}),
            callback = function(ev)
              local opts = function(desc) return { buffer = ev.buf, desc = desc } end

              vim.keymap.set('n', '<leader>cd', vim.lsp.buf.definition, opts('Definition'))
              vim.keymap.set('n', '<leader>cD', vim.lsp.buf.declaration, opts('Declaration'))
              vim.keymap.set('n', '<leader>ci', vim.lsp.buf.implementation, opts('Implementation'))
              vim.keymap.set('n', '<leader>ct', vim.lsp.buf.type_definition, opts('Type definition'))
              vim.keymap.set('n', '<leader>cR', vim.lsp.buf.references, opts('References'))
              vim.keymap.set('n', '<leader>cr', vim.lsp.buf.rename, opts('Rename'))
              vim.keymap.set('n', '<leader>ca', vim.lsp.buf.code_action, opts('Code action'))
              vim.keymap.set('n', '<leader>cf', function() vim.lsp.buf.format({ async = true }) end, opts('Format'))
              vim.keymap.set('n', '<leader>cl', vim.diagnostic.open_float, opts('Line diagnostic'))
            end,
          })
        '';
      };
    };
}
