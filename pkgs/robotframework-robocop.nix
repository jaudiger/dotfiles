{
  lib,
  buildPythonPackage,
  pythonOlder,
  fetchFromGitHub,
  hatchling,
  jinja2,
  robotframework,
  typer,
  rich,
  tomli,
  tomli-w,
  pathspec,
  platformdirs,
  pytz,
  msgpack,
  typing-extensions,
}:

buildPythonPackage rec {
  pname = "robotframework-robocop";
  version = "8.2.0";
  pyproject = true;

  disabled = pythonOlder "3.10";

  src = fetchFromGitHub {
    owner = "MarketSquare";
    repo = "robotframework-robocop";
    rev = "v${version}";
    hash = "sha256-3nyMLl8k+f5VgMy44/iVMdmJqRqRuUUQUm0g5UQYmMc=";
  };

  nativeBuildInputs = [
    hatchling
  ];

  # Dependencies for the build
  propagatedBuildInputs = [
    jinja2
    robotframework
    typer
    rich
    tomli
    tomli-w
    pathspec
    platformdirs
    pytz
    msgpack
    typing-extensions
  ];

  pythonImportsCheck = [ "robocop" ];

  meta = with lib; {
    description = "Tool for static code analysis of Robot Framework language";
    homepage = "https://github.com/MarketSquare/robotframework-robocop";
    license = licenses.asl20;
    maintainers = with maintainers; [ jaudiger ];
  };
}
