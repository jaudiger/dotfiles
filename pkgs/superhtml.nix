{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation rec {
  pname = "superhtml";
  version = "8cb16babb0c66b6512d6aeb4cbc37ed90641d980";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "superhtml";
    rev = version;
    hash = "sha256-lLZqyqVEUCn9z++9lPnrK8R2uDvht5v+5Y8KOZDgPs0=";
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
