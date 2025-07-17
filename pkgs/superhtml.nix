{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation rec {
  pname = "superhtml";
  version = "13f5a2221cb748bbe50ad702e89362afd5b925a7";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "superhtml";
    rev = version;
    hash = "sha256-kAQ1jxiVUhAVmIsyWAwqK2e0kJOsfN0h3m90VdRwiJ0=";
  };

  nativeBuildInputs = [
    zig.hook
  ];

  meta = with lib; {
    description = "HTML Language Server & Templating Language Library";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
